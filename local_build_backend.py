from __future__ import annotations

import base64
import csv
import hashlib
import os
from pathlib import Path
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parent


def _project() -> dict:
    with (ROOT / "pyproject.toml").open("rb") as file:
        return tomllib.load(file)["project"]


def _distribution_name(name: str) -> str:
    return name.replace("-", "_")


def _dist_info_dir(project: dict) -> str:
    return f"{_distribution_name(project['name'])}-{project['version']}.dist-info"


def _metadata(project: dict) -> bytes:
    lines = [
        "Metadata-Version: 2.1",
        f"Name: {project['name']}",
        f"Version: {project['version']}",
        f"Summary: {project.get('description', '')}",
    ]

    for dependency in project.get("dependencies", []):
        lines.append(f"Requires-Dist: {dependency}")

    return ("\n".join(lines) + "\n").encode("utf-8")


def _wheel_file() -> bytes:
    return (
        "Wheel-Version: 1.0\n"
        "Generator: local_build_backend\n"
        "Root-Is-Purelib: true\n"
        "Tag: py3-none-any\n"
    ).encode("utf-8")


def _entry_points(project: dict) -> bytes | None:
    scripts = project.get("scripts", {})
    if not scripts:
        return None

    lines = ["[console_scripts]"]
    lines.extend(f"{name} = {target}" for name, target in scripts.items())
    return ("\n".join(lines) + "\n").encode("utf-8")


def _record_row(path: str, data: bytes) -> list[str]:
    digest = hashlib.sha256(data).digest()
    encoded_digest = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return [path, f"sha256={encoded_digest}", str(len(data))]


def _editable_entries(project: dict) -> dict[str, bytes]:
    dist_info = _dist_info_dir(project)
    entries = {
        f"{_distribution_name(project['name'])}.pth": f"{ROOT}{os.linesep}".encode("utf-8"),
        f"{dist_info}/METADATA": _metadata(project),
        f"{dist_info}/WHEEL": _wheel_file(),
    }

    entry_points = _entry_points(project)
    if entry_points is not None:
        entries[f"{dist_info}/entry_points.txt"] = entry_points

    return entries


def _write_wheel(wheel_directory: str, project: dict, *, editable: bool) -> str:
    wheel_directory_path = Path(wheel_directory)
    wheel_directory_path.mkdir(parents=True, exist_ok=True)

    normalized_name = _distribution_name(project["name"])
    wheel_name = f"{normalized_name}-{project['version']}-py3-none-any.whl"
    wheel_path = wheel_directory_path / wheel_name
    dist_info = _dist_info_dir(project)

    entries = _editable_entries(project)
    record_rows = [_record_row(path, data) for path, data in entries.items()]
    record_rows.append([f"{dist_info}/RECORD", "", ""])

    with zipfile.ZipFile(wheel_path, "w", compression=zipfile.ZIP_DEFLATED) as wheel:
        for path, data in entries.items():
            wheel.writestr(path, data)

        record_buffer = []
        for row in record_rows:
            record_buffer.append(",".join(row))
        wheel.writestr(f"{dist_info}/RECORD", ("\n".join(record_buffer) + "\n").encode("utf-8"))

    return wheel_name


def _prepare_metadata(metadata_directory: str, project: dict) -> str:
    metadata_root = Path(metadata_directory)
    dist_info = metadata_root / _dist_info_dir(project)
    dist_info.mkdir(parents=True, exist_ok=True)
    (dist_info / "METADATA").write_bytes(_metadata(project))
    (dist_info / "WHEEL").write_bytes(_wheel_file())
    entry_points = _entry_points(project)
    if entry_points is not None:
        (dist_info / "entry_points.txt").write_bytes(entry_points)
    return dist_info.name


def get_requires_for_build_wheel(config_settings=None):
    return []


def get_requires_for_build_editable(config_settings=None):
    return []


def prepare_metadata_for_build_wheel(metadata_directory, config_settings=None):
    return _prepare_metadata(metadata_directory, _project())


def prepare_metadata_for_build_editable(metadata_directory, config_settings=None):
    return _prepare_metadata(metadata_directory, _project())


def build_wheel(wheel_directory, config_settings=None, metadata_directory=None):
    return _write_wheel(wheel_directory, _project(), editable=False)


def build_editable(wheel_directory, config_settings=None, metadata_directory=None):
    return _write_wheel(wheel_directory, _project(), editable=True)


def _supported_features():
    return ["build_editable"]
