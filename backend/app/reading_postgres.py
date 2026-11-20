"""PostgreSQL connection for the reading API."""
import os
import re
from uuid import UUID
from contextlib import contextmanager
from datetime import datetime, timezone
from urllib.parse import parse_qsl, unquote, urlsplit

from psycopg import ClientCursor, Error, connect, sql
from psycopg.rows import dict_row
from psycopg.types.json import set_json_loads


def reading_row(cursor):
    make_dict = dict_row(cursor)

    def normalize(values):
        return make_dict([
            value.astimezone(timezone.utc).isoformat() if isinstance(value, datetime) else value
            for value in values
        ])

    return normalize


class ReadingPostgres:
    def __init__(self, url, root_certificate):
        from .reading_identity import production

        self.account_id = None
        try:
            address = urlsplit(url)
            if address.scheme not in ("postgres", "postgresql") or not address.hostname or address.fragment:
                raise ValueError
            options = dict(parse_qsl(address.query))
            local_test = (address.hostname in ("localhost", "127.0.0.1", "::1")
                          and os.getenv("READING_TEST_LOCAL_PG") == "1" and address.path == "/reading_test")
            if production() and not local_test:
                project = urlsplit(os.environ["SUPABASE_URL"]).hostname.split(".")[0]
                if (not re.fullmatch(r"aws-\d+-ap-northeast-2\.pooler\.supabase\.com", address.hostname)
                        or unquote(address.username or "") != "intereading_runtime." + project
                        or (address.port or 5432) != 5432):
                    raise RuntimeError("Use the selected Seoul project's session pooler and dedicated reading login")
            self.connection = connect(
                host=address.hostname,
                port=address.port or 5432,
                dbname=unquote(address.path.lstrip("/")),
                user=unquote(address.username or ""),
                password=unquote(address.password or ""),
                sslmode="disable" if local_test else "verify-full",
                sslrootcert=None if local_test else root_certificate or options.get("sslrootcert") or "system",
                connect_timeout=10,

                autocommit=True,
                cursor_factory=ClientCursor,
                row_factory=reading_row,
            )
        except (Error, ValueError):
            raise RuntimeError("Reading PostgreSQL connection failed. Check the URL, password and CA certificate.") from None

        # The shared API decodes stored JSON text from SQLite and PostgreSQL alike.
        set_json_loads(bytes.decode, self.connection)
        if not production():
            self.connection.execute("SET search_path TO reading, pg_catalog")
        else:
            try:
                self.connection.execute("SET ROLE reading_service")
                self.connection.execute("SET search_path TO pg_catalog")
            except BaseException:
                self.connection.close()
                raise

    def check_installation(self):
        row = self.connection.execute("SELECT database_id, schema_version FROM reading_control.installation").fetchone()
        if not row or row["database_id"] != UUID(os.environ["READING_DATABASE_ID"]) or row["schema_version"] != 1:
            raise RuntimeError("Unexpected production reading database or schema version")
        return row

    def select_reader(self, account_id, seed):
        reader = UUID(account_id)
        self.account_id = str(reader)
        with self.connection.transaction():
            self.check_installation()
            exists = self.execute("SELECT 1 FROM reading_control.readers WHERE account_id = ?", (reader,)).fetchone()
            created = not exists and self.execute("SELECT reading_control.provision(?) AS created", (reader,)).fetchone()["created"]
            self.connection.execute(sql.SQL("SET search_path TO {}, pg_catalog").format(sql.Identifier("reader_" + reader.hex)))
            if created:
                seed(self)

    def execute(self, sql, params=()):
        return self.connection.execute(sql.replace("?", "%s"), params)

    def executemany(self, sql, params):
        with self.connection.cursor() as cursor:
            cursor.executemany(sql.replace("?", "%s"), params)

    @contextmanager
    def write_transaction(self):
        with self.connection.transaction():
            self.execute("SELECT pg_advisory_xact_lock(hashtextextended(?, 4))", (self.account_id or "demo",))
            yield

    def close(self):
        self.connection.close()
