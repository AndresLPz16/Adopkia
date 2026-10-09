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
            statements[0].startswith("DROP DATABASE IF EXISTS `adopkia_cmp`")
        )
        self.assertTrue(
            any(
                statement.startswith("CREATE DATABASE `adopkia_cmp`")
                for statement in statements
            )
        )
        self.assertFalse(
            any(
                statement.startswith(
                    ("DROP DATABASE IF EXISTS adopkia", "CREATE DATABASE adopkia", "USE adopkia")
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
