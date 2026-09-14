from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


TAG_PATTERN = re.compile(r"^sha-([0-9a-f]{40})$")

STAGING_VALUES = Path(
    "infra/helm/life-planning/values-staging.yaml"
)

PRODUCTION_VALUES = Path(
    "infra/helm/life-planning/values-production.yaml"
)


class PromotionValidationError(RuntimeError):
    pass


@dataclass(frozen=True)
class PromotionState:
    staging_tag: str
    production_tag: str
    base_staging_tag: str
    base_production_tag: str

    @property
    def staging_changed(self) -> bool:
        return self.staging_tag != self.base_staging_tag

    @property
    def production_changed(self) -> bool:
        return self.production_tag != self.base_production_tag


def parse_image_tag(text: str) -> str:
    lines = text.splitlines()

    image_index = None

    for index, line in enumerate(lines):
        if re.fullmatch(r"image:\s*", line):
            image_index = index
            break

    if image_index is None:
        raise PromotionValidationError(
            "top-level image block was not found"
        )

    for line in lines[image_index + 1 :]:
        if line and not line[0].isspace():
            break

        match = re.fullmatch(
            r"""\s+tag:\s*["']?([^"'\s]+)["']?\s*""",
            line,
        )

        if match:
            return match.group(1)

    raise PromotionValidationError(
        "image.tag was not found inside the image block"
    )


def validate_immutable_tag(tag: str, environment: str) -> None:
    if not TAG_PATTERN.fullmatch(tag):
        raise PromotionValidationError(
            f"{environment} image.tag must use "
            "sha-<40 lowercase hex Git SHA>; "
            f"found {tag!r}"
        )


def git_show(ref: str, path: Path) -> str:
    result = subprocess.run(
        ["git", "show", f"{ref}:{path.as_posix()}"],
        check=False,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise PromotionValidationError(
            f"unable to read {path.as_posix()} from base ref "
            f"{ref!r}: {result.stderr.strip()}"
        )

    return result.stdout


def load_current_state(base_ref: str) -> PromotionState:
    staging_text = STAGING_VALUES.read_text(encoding="utf-8")
    production_text = PRODUCTION_VALUES.read_text(
        encoding="utf-8"
    )

    base_staging_text = git_show(
        base_ref,
        STAGING_VALUES,
    )

    base_production_text = git_show(
        base_ref,
        PRODUCTION_VALUES,
    )

    return PromotionState(
        staging_tag=parse_image_tag(staging_text),
        production_tag=parse_image_tag(production_text),
        base_staging_tag=parse_image_tag(base_staging_text),
        base_production_tag=parse_image_tag(
            base_production_text
        ),
    )


def validate_state(state: PromotionState) -> None:
    validate_immutable_tag(
        state.staging_tag,
        "staging",
    )

    validate_immutable_tag(
        state.production_tag,
        "production",
    )

    validate_immutable_tag(
        state.base_staging_tag,
        "base staging",
    )

    validate_immutable_tag(
        state.base_production_tag,
        "base production",
    )

    if state.staging_changed and state.production_changed:
        raise PromotionValidationError(
            "staging and production release pins must not "
            "change in the same promotion change; promote "
            "staging first, validate it, then promote "
            "production in a separate change"
        )

    if state.production_changed:
        if state.production_tag != state.base_staging_tag:
            raise PromotionValidationError(
                "production may only promote the release that "
                "was already pinned in staging in the base "
                "commit; "
                f"production={state.production_tag}, "
                f"base-staging={state.base_staging_tag}"
            )


def state_to_dict(state: PromotionState) -> dict[str, object]:
    return {
        "staging_tag": state.staging_tag,
        "production_tag": state.production_tag,
        "base_staging_tag": state.base_staging_tag,
        "base_production_tag": state.base_production_tag,
        "staging_changed": state.staging_changed,
        "production_changed": state.production_changed,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Validate immutable GitOps release promotion "
            "ordering."
        )
    )

    parser.add_argument(
        "--base-ref",
        required=True,
        help=(
            "Git ref representing the target/base state "
            "before this promotion."
        ),
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON on success.",
    )

    return parser


def main() -> int:
    args = build_parser().parse_args()

    try:
        state = load_current_state(args.base_ref)
        validate_state(state)
    except (
        PromotionValidationError,
        OSError,
    ) as exc:
        print(
            f"PromotionValidation=FAIL\nReason={exc}",
            file=sys.stderr,
        )
        return 1

    result = state_to_dict(state)

    if args.json:
        print(
            json.dumps(
                result,
                sort_keys=True,
                separators=(",", ":"),
            )
        )
    else:
        print("PromotionValidation=PASS")

        for key, value in result.items():
            print(f"{key}={value}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
