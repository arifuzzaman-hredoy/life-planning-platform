from __future__ import annotations

import importlib.util
import pathlib
import sys
import unittest


SCRIPT = pathlib.Path(__file__).with_name(
    "validate_promotion.py"
)

SPEC = importlib.util.spec_from_file_location(
    "validate_promotion",
    SCRIPT,
)

if SPEC is None or SPEC.loader is None:
    raise RuntimeError(
        "could not load validate_promotion.py"
    )

MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class PromotionValidationTests(unittest.TestCase):
    def test_parse_image_tag(self):
        text = """
image:
  repository: example/app
  tag: sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
service:
  port: 80
"""

        self.assertEqual(
            MODULE.parse_image_tag(text),
            "sha-" + ("a" * 40),
        )

    def test_invalid_tag_rejected(self):
        with self.assertRaises(
            MODULE.PromotionValidationError
        ):
            MODULE.validate_immutable_tag(
                "latest",
                "staging",
            )

    def test_no_change_passes(self):
        tag = "sha-" + ("a" * 40)

        state = MODULE.PromotionState(
            staging_tag=tag,
            production_tag=tag,
            base_staging_tag=tag,
            base_production_tag=tag,
        )

        MODULE.validate_state(state)

    def test_staging_only_promotion_passes(self):
        old = "sha-" + ("a" * 40)
        new = "sha-" + ("b" * 40)

        state = MODULE.PromotionState(
            staging_tag=new,
            production_tag=old,
            base_staging_tag=old,
            base_production_tag=old,
        )

        MODULE.validate_state(state)

    def test_production_promotes_base_staging_passes(self):
        production_old = "sha-" + ("a" * 40)
        staged = "sha-" + ("b" * 40)

        state = MODULE.PromotionState(
            staging_tag=staged,
            production_tag=staged,
            base_staging_tag=staged,
            base_production_tag=production_old,
        )

        MODULE.validate_state(state)

    def test_production_skipping_staging_fails(self):
        production_old = "sha-" + ("a" * 40)
        staged = "sha-" + ("b" * 40)
        unvalidated = "sha-" + ("c" * 40)

        state = MODULE.PromotionState(
            staging_tag=staged,
            production_tag=unvalidated,
            base_staging_tag=staged,
            base_production_tag=production_old,
        )

        with self.assertRaises(
            MODULE.PromotionValidationError
        ):
            MODULE.validate_state(state)

    def test_staging_and_production_same_change_fails(self):
        old = "sha-" + ("a" * 40)
        new = "sha-" + ("b" * 40)

        state = MODULE.PromotionState(
            staging_tag=new,
            production_tag=new,
            base_staging_tag=old,
            base_production_tag=old,
        )

        with self.assertRaises(
            MODULE.PromotionValidationError
        ):
            MODULE.validate_state(state)

    def test_uppercase_sha_rejected(self):
        with self.assertRaises(
            MODULE.PromotionValidationError
        ):
            MODULE.validate_immutable_tag(
                "sha-" + ("A" * 40),
                "production",
            )


if __name__ == "__main__":
    unittest.main()
