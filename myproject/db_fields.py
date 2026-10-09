from django.db import models


class EnumField(models.CharField):
    def db_type(self, connection):
        if connection.vendor != "mysql":
            return super().db_type(connection)
        values = ",".join(
            "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"
            for value, _label in self.choices
        )
        return f"enum({values})"


class TinyIntegerField(models.SmallIntegerField):
    def db_type(self, connection):
        if connection.vendor == "mysql":
            return "tinyint"
        return super().db_type(connection)

    def get_internal_type(self):
        return "SmallIntegerField"


class TinyAutoField(models.AutoField):
    def db_type(self, connection):
        if connection.vendor == "mysql":
            return "tinyint unsigned AUTO_INCREMENT"
        return super().db_type(connection)

    def rel_db_type(self, connection):
        if connection.vendor == "mysql":
            return "tinyint unsigned"
        return self.db_type(connection)


class SQLTextField(models.TextField):
    def db_type(self, connection):
        if connection.vendor == "mysql":
            return "text"
        return super().db_type(connection)


class SQLDateTimeField(models.DateTimeField):
    def db_type(self, connection):
        if connection.vendor == "mysql":
            return "datetime"
        return super().db_type(connection)
