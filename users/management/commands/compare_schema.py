import re
import tempfile
from collections import defaultdict
from pathlib import Path

import pymysql
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


DJANGO_FRAMEWORK_TABLES = frozenset(
    {
        "django_migrations",
        "django_content_type",
        "django_admin_log",
        "django_session",
        "auth_group",
        "auth_group_permissions",
        "auth_permission",
    }
)


class Command(BaseCommand):
    help = (
        "Compara el esquema MySQL con database/adopkia_v3.sql "
        "usando una base temporal aislada."
    )

    def handle(self, *args, **options):
        database = settings.DATABASES["default"]
        if database["ENGINE"] != "django.db.backends.mysql":
            raise CommandError("compare_schema solo se ejecuta con DB_ENGINE=mysql.")

        schema_name = "adopkia_cmp"
        if database["NAME"] != "adopkia":
            raise CommandError(
                "compare_schema requiere DB_NAME=adopkia; solo se permite usar "
                "adopkia, test_adopkia y adopkia_cmp."
            )
        connection = self._connect(database)
        try:
            statements = self._read_script(schema_name)
            with connection.cursor() as cursor:
                for statement in statements:
                    cursor.execute(statement)

            expected = self._inspect_schema(connection, schema_name)
            actual = self._inspect_schema(connection, database["NAME"])
            differences = self._compare(expected, actual)
            if differences:
                for difference in differences:
                    self.stderr.write(f"- {difference}")
                raise CommandError(
                    f"compare_schema encontró {len(differences)} diferencia(s). "
                    f"Se eliminó el esquema temporal {schema_name}."
                )
            self.stdout.write(
                self.style.SUCCESS(
                    "compare_schema: sin diferencias en tablas, columnas, tipos, "
                    "nulabilidad, PK, UNIQUE, FK, CHECK, funciones, triggers y vistas."
                )
            )
        finally:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f"DROP DATABASE IF EXISTS `{schema_name}`")
            finally:
                connection.close()

    def _connect(self, database):
        return pymysql.connect(
            host=database["HOST"] or "localhost",
            port=int(database["PORT"] or 3306),
            user=database["USER"],
            password=database["PASSWORD"],
            charset=database.get("OPTIONS", {}).get("charset", "utf8mb4"),
            autocommit=True,
        )

    def _read_script(self, temporary_schema):
        script_path = settings.BASE_DIR / "database" / "adopkia_v3.sql"
        if not script_path.is_file():
            raise CommandError(f"No se encontró el SQL de referencia: {script_path}")
        source = script_path.read_text(encoding="utf-8")
        source = re.sub(
            r"(?im)^DROP\s+DATABASE\s+IF\s+EXISTS\s+adopkia\s*;",
            f"DROP DATABASE IF EXISTS `{temporary_schema}`;",
            source,
        )
        source = re.sub(
            r"(?im)^CREATE\s+DATABASE\s+adopkia\b",
            f"CREATE DATABASE `{temporary_schema}`",
            source,
        )
        source = re.sub(
            r"(?im)^USE\s+adopkia\s*;",
            f"USE `{temporary_schema}`;",
            source,
        )
        with tempfile.TemporaryDirectory(prefix="adopkia_cmp_script_") as directory:
            temporary_script = Path(directory) / "adopkia_v3.sql"
            temporary_script.write_text(source, encoding="utf-8")
            statements = list(self._split_mysql_script(
                temporary_script.read_text(encoding="utf-8")
            ))
        if any(
            re.match(
                r"(?i)^(?:DROP\s+DATABASE\s+(?:IF\s+EXISTS\s+)?|"
                r"CREATE\s+DATABASE\s+|USE\s+)`?adopkia`?(?:\s|;|$)",
                statement,
            )
            for statement in statements
        ):
            raise CommandError("Se rechazó el SQL: aún contiene una operación sobre adopkia.")
        return statements

    def _split_mysql_script(self, source):
        delimiter = ";"
        buffer = []
        quote = None
        escaped = False
        for line in source.splitlines():
            delimiter_command = re.match(r"^\s*DELIMITER\s+(\S+)\s*$", line, re.I)
            if delimiter_command:
                delimiter = delimiter_command.group(1)
                continue
            if line.lstrip().startswith("--"):
                continue
            index = 0
            while index < len(line):
                character = line[index]
                if quote:
                    buffer.append(character)
                    if escaped:
                        escaped = False
                    elif character == "\\":
                        escaped = True
                    elif character == quote:
                        if index + 1 < len(line) and line[index + 1] == quote:
                            buffer.append(line[index + 1])
                            index += 1
                        else:
                            quote = None
                    index += 1
                    continue
                if character in ("'", '"', "`"):
                    quote = character
                    buffer.append(character)
                    index += 1
                    continue
                if line.startswith(delimiter, index):
                    statement = "".join(buffer).strip()
                    if statement:
                        yield statement
                    buffer.clear()
                    index += len(delimiter)
                    continue
                buffer.append(character)
                index += 1
            buffer.append("\n")
        statement = "".join(buffer).strip()
        if statement:
            raise CommandError("El SQL de referencia termina con una sentencia incompleta.")

    def _inspect_schema(self, connection, schema_name):
        result = {
            "tables": {},
            "views": {},
            "functions": {},
            "triggers": {},
        }
        with connection.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                "SELECT table_name AS table_name FROM information_schema.tables "
                "WHERE table_schema=%s AND table_type='BASE TABLE'",
                (schema_name,),
            )
            table_names = {
                row["table_name"]
                for row in cursor.fetchall()
                if row["table_name"] not in DJANGO_FRAMEWORK_TABLES
            }
            for table_name in table_names:
                result["tables"][table_name] = self._inspect_table(
                    cursor, schema_name, table_name
                )

            cursor.execute(
                "SELECT table_name AS table_name, view_definition AS view_definition "
                "FROM information_schema.views "
                "WHERE table_schema=%s",
                (schema_name,),
            )
            result["views"] = {
                row["table_name"]: self._normalize_sql(row["view_definition"])
                for row in cursor.fetchall()
            }

            cursor.execute(
                "SELECT routine_name AS routine_name, "
                "routine_definition AS routine_definition FROM information_schema.routines "
                "WHERE routine_schema=%s AND routine_type='FUNCTION'",
                (schema_name,),
            )
            result["functions"] = {
                row["routine_name"]: self._normalize_sql(row["routine_definition"])
                for row in cursor.fetchall()
            }

            cursor.execute(
                "SELECT trigger_name AS trigger_name, "
                "event_object_table AS event_object_table, "
                "event_manipulation AS event_manipulation, "
                "action_timing AS action_timing, action_statement AS action_statement "
                "FROM information_schema.triggers WHERE trigger_schema=%s",
                (schema_name,),
            )
            result["triggers"] = {
                row["trigger_name"]: (
                    row["event_object_table"].lower(),
                    row["event_manipulation"].lower(),
                    row["action_timing"].lower(),
                    self._normalize_sql(row["action_statement"]),
                )
                for row in cursor.fetchall()
            }
        return result

    def _inspect_table(self, cursor, schema_name, table_name):
        cursor.execute(
            "SELECT column_name AS column_name, column_type AS column_type, "
            "is_nullable AS is_nullable, generation_expression AS generation_expression, "
            "extra AS extra "
            "FROM information_schema.columns "
            "WHERE table_schema=%s AND table_name=%s ORDER BY ordinal_position",
            (schema_name, table_name),
        )
        columns = {
            row["column_name"]: (
                self._normalize_type(row["column_type"]),
                row["is_nullable"] == "YES",
                self._normalize_expression(row["generation_expression"] or ""),
                "auto_increment" in row["extra"].lower(),
            )
            for row in cursor.fetchall()
        }

        cursor.execute(
            "SELECT column_name AS column_name FROM information_schema.key_column_usage "
            "WHERE table_schema=%s AND table_name=%s AND constraint_name='PRIMARY' "
            "ORDER BY ordinal_position",
            (schema_name, table_name),
        )
        primary_key = tuple(row["column_name"] for row in cursor.fetchall())

        cursor.execute(
            "SELECT index_name AS index_name, column_name AS column_name "
            "FROM information_schema.statistics "
            "WHERE table_schema=%s AND table_name=%s AND non_unique=0 "
            "AND index_name <> 'PRIMARY' ORDER BY index_name, seq_in_index",
            (schema_name, table_name),
        )
        unique_indexes = defaultdict(list)
        for row in cursor.fetchall():
            unique_indexes[row["index_name"]].append(row["column_name"])
        unique = tuple(
            sorted(tuple(columns) for columns in unique_indexes.values())
        )

        cursor.execute(
            "SELECT k.column_name AS column_name, "
            "k.referenced_table_name AS referenced_table_name, "
            "k.referenced_column_name AS referenced_column_name, "
            "r.delete_rule AS delete_rule, r.update_rule AS update_rule, "
            "k.constraint_name AS constraint_name, k.ordinal_position AS ordinal_position "
            "FROM information_schema.key_column_usage k "
            "JOIN information_schema.referential_constraints r "
            "ON r.constraint_schema=k.constraint_schema AND r.constraint_name=k.constraint_name "
            "AND r.table_name=k.table_name "
            "WHERE k.table_schema=%s AND k.table_name=%s "
            "AND k.referenced_table_name IS NOT NULL "
            "ORDER BY k.constraint_name, k.ordinal_position",
            (schema_name, table_name),
        )
        foreign_keys = defaultdict(list)
        for row in cursor.fetchall():
            foreign_keys[row["constraint_name"]].append(
                (
                    row["column_name"],
                    row["referenced_table_name"],
                    row["referenced_column_name"],
                    self._normalize_delete_rule(row["delete_rule"]),
                    self._normalize_delete_rule(row["update_rule"]),
                )
            )
        foreign_keys = tuple(sorted(tuple(parts) for parts in foreign_keys.values()))

        cursor.execute(
            "SELECT tc.constraint_name AS constraint_name, cc.check_clause AS check_clause "
            "FROM information_schema.table_constraints tc "
            "JOIN information_schema.check_constraints cc "
            "ON cc.constraint_schema=tc.constraint_schema "
            "AND cc.constraint_name=tc.constraint_name "
            "WHERE tc.table_schema=%s AND tc.table_name=%s "
            "AND tc.constraint_type='CHECK'",
            (schema_name, table_name),
        )
        checks = tuple(
            sorted(
                self._normalize_expression(row["check_clause"])
                for row in cursor.fetchall()
            )
        )
        return {
            "columns": columns,
            "primary_key": primary_key,
            "unique": unique,
            "foreign_keys": foreign_keys,
            "checks": checks,
        }

    def _compare(self, expected, actual):
        differences = []
        for category in ("tables", "views", "functions", "triggers"):
            expected_names = set(expected[category])
            actual_names = set(actual[category])
            for name in sorted(expected_names - actual_names):
                differences.append(f"{category}: falta {name}")
            for name in sorted(actual_names - expected_names):
                differences.append(f"{category}: sobra {name}")
            for name in sorted(expected_names & actual_names):
                if expected[category][name] != actual[category][name]:
                    differences.append(
                        f"{category}.{name}: definición distinta "
                        f"(SQL v3={expected[category][name]!r}; Django={actual[category][name]!r})"
                    )

        for table_name in sorted(set(expected["tables"]) & set(actual["tables"])):
            expected_table = expected["tables"][table_name]
            actual_table = actual["tables"][table_name]
            expected_columns = set(expected_table["columns"])
            actual_columns = set(actual_table["columns"])
            for name in sorted(expected_columns - actual_columns):
                differences.append(f"{table_name}.{name}: columna faltante")
            for name in sorted(actual_columns - expected_columns):
                differences.append(f"{table_name}.{name}: columna adicional")
            for name in sorted(expected_columns & actual_columns):
                if expected_table["columns"][name] != actual_table["columns"][name]:
                    differences.append(
                        f"{table_name}.{name}: columna distinta "
                        f"(SQL v3={expected_table['columns'][name]!r}; "
                        f"Django={actual_table['columns'][name]!r})"
                    )
            for key, label in (
                ("primary_key", "PK"),
                ("unique", "UNIQUE"),
                ("foreign_keys", "FK/ON DELETE"),
                ("checks", "CHECK"),
            ):
                if expected_table[key] != actual_table[key]:
                    differences.append(
                        f"{table_name}.{label}: distinto "
                        f"(SQL v3={expected_table[key]!r}; Django={actual_table[key]!r})"
                    )
        return differences

    def _normalize_type(self, column_type):
        normalized = re.sub(
            r"\s+(?:unsigned|zerofill)\b", "", column_type.lower()
        )
        normalized = re.sub(r"\b(?:unsigned|zerofill)\b", "", normalized)
        return re.sub(r"\s+", "", normalized)

    def _normalize_delete_rule(self, rule):
        normalized = rule.lower()
        return "restrict" if normalized == "no action" else normalized

    def _normalize_sql(self, sql):
        normalized = (sql or "").lower().replace("`", "")
        normalized = re.sub(r"\b(?:adopkia|adopkia_cmp)\.", "schema.", normalized)
        normalized = re.sub(r"_(?:utf8mb4|utf8|latin1)(?=')", "", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized.rstrip(";")

    def _normalize_expression(self, sql):
        return re.sub(r"[()\s]", "", self._normalize_sql(sql))
