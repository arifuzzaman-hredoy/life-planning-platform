import unittest
import validate_platform


class PlatformValidationTests(unittest.TestCase):
    def test_config_list_is_not_empty(self):
        self.assertGreater(len(validate_platform.YAML_FILES), 10)


if __name__ == "__main__":
    unittest.main()
