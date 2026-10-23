from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)


class PackageEvent(Base):
    __tablename__ = "package_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
