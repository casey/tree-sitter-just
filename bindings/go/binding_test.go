package tree_sitter_just_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_just "github.com/casey/tree-sitter-just/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_just.Language())
	if language == nil {
		t.Errorf("Error loading Just grammar")
	}
}
