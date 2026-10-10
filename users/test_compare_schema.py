from contextlib import nullcontext
from unittest.mock import Mock, call, patch

from django.core.management.base import CommandError
from django.test import SimpleTestCase

from users.management.commands.compare_schema import (
    DJANGO_FRAMEWORK_TABLES,
    Command,
)


class CompareSchemaParserTests(SimpleTestCase):
    def test_framework_tables_are_excluded_from_business_schema_comparison(self):
        self.assertEqual(
            DJANGO_FRAMEWORK_TABLES,
            {
                "django_migrations",
                "django_content_type",
                "django_admin_log",
                "django_session",
                "auth_group",
                "auth_group_permissions",
                "auth_permission",
            },
        )

    def test_sql_script_uses_only_a_temporary_database(self):
        statements = Command()._read_script("adopkia_cmp")
        self.assertTrue(
            any(
                statement.startswith(
                    "CREATE DATABASE IF NOT EXISTS `adopkia_cmp`"
                )
                for statement in statements
            )
        )
        self.assertFalse(
            any(
                statement.startswith(
                    (
                        "DROP DATABASE adopkia",
                        "CREATE DATABASE adopkia",
                        "CREATE DATABASE IF NOT EXISTS adopkia",
                        "USE adopkia",
                    )
                )
                for statement in statements
            )
        )
        self.assertEqual(
            sum(statement.upper().startswith("CREATE FUNCTION ") for statement in statements),
            2,
        )
        self.assertEqual(
            sum(statement.upper().startswith("CREATE TRIGGER ") for statement in statements),
            13,
        )
        self.assertEqual(
            sum(statement.upper().startswith("CREATE OR REPLACE VIEW ") for statement in statements),
            2,
        )

    def test_splitter_honors_routine_delimiter_and_quoted_semicolons(self):
        source = (
            "DELIMITER $$\n"
            "CREATE FUNCTION sample() RETURNS VARCHAR(10) BEGIN "
            "RETURN 'a;b'; END$$\n"
            "DELIMITER ;\n"
            "SELECT 'x;y';\n"
        )
        statements = list(Command()._split_mysql_script(source))
        self.assertEqual(len(statements), 2)
        self.assertIn("RETURN 'a;b'; END", statements[0])
        self.assertEqual(statements[1], "SELECT 'x;y'")

    def test_existing_temporary_database_requires_force(self):
        connection = Mock()
        command = Command()
        database = {
            "ENGINE": "django.db.backends.mysql",
            "NAME": "adopkia",
        }
        with (
            patch("users.management.commands.compare_schema.settings.DATABASES", {"default": database}),
            patch.object(command, "_connect", return_value=connection),
            patch.object(command, "_database_exists", return_value=True),
            patch.object(command, "_drop_schema") as drop_schema,
        ):
            with self.assertRaisesMessage(CommandError, "ya existe"):
                command.handle(force=False)

        drop_schema.assert_not_called()
        connection.close.assert_called_once()

    def test_force_replaces_existing_schema_and_cleans_only_its_schema(self):
        connection = Mock()
        cursor = Mock()
        connection.cursor.return_value = nullcontext(cursor)
        command = Command()
        database = {
            "ENGINE": "django.db.backends.mysql",
            "NAME": "adopkia",
        }
        with (
            patch("users.management.commands.compare_schema.settings.DATABASES", {"default": database}),
            patch.object(command, "_connect", return_value=connection),
            patch.object(command, "_database_exists", return_value=True),
            patch.object(command, "_read_script", return_value=[
                "CREATE DATABASE IF NOT EXISTS `adopkia_cmp`",
                "USE `adopkia_cmp`",
            ]),
            patch.object(command, "_inspect_schema", return_value={"schema": "same"}),
            patch.object(command, "_compare", return_value=[]),
            patch.object(command, "_drop_schema") as drop_schema,
        ):
            command.handle(force=True)

        self.assertEqual(
            drop_schema.call_args_list,
            [call(connection, "adopkia_cmp"), call(connection, "adopkia_cmp")],
        )
        connection.close.assert_called_once()
