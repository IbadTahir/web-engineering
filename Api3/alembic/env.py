from logging.config import fileConfig
import os
import sys
from pathlib import Path

# Add the project root directory to Python path
root = str(Path(__file__).resolve().parents[1])
sys.path.append(root)

from alembic import context
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

# Import database models
from app.models.evaluator import *
from app.models.book import *
from app.models.user import *
from app.models.video import *

# this is the Alembic Config object
config = context.config

# Set SQLite URL from env var, with a default
config.set_main_option('sqlalchemy.url', os.getenv(
    'DATABASE_URL', 'sqlite:///edu_platform.db'
))

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
