from unittest import TestCase

import tree_sitter_just

from tree_sitter import Language, Parser


class TestLanguage(TestCase):
    def test_can_load_grammar(self):
        Parser(Language(tree_sitter_just.language()))

    def test_can_parse_recipe_with_body(self):
        parser = Parser(Language(tree_sitter_just.language()))
        tree = parser.parse(b"build:\n    echo hello\n")
        self.assertFalse(tree.root_node.has_error)
        recipe = tree.root_node.named_children[0]
        self.assertEqual(recipe.type, "recipe")
        self.assertEqual(
            [child.type for child in recipe.named_children],
            ["recipe_header", "recipe_body"],
        )
