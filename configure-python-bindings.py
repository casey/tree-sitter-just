"""Apply Just's Python packaging requirements after Tree-sitter initialization."""

from pathlib import Path


def configure(source: str) -> str:
    replacements = (
        # Backport the current Tree-sitter template's scanner inclusion fix.
        (
            '        self.filelist.include("src/tree_sitter/*.h")\n',
            (
                '        self.filelist.include("src/tree_sitter/*.h")\n'
                '        self.filelist.include("src/*.c")\n'
            ),
        ),
        (
            '            include_dirs=["src"],\n',
            (
                "            # The scanner requires assertions, but Python defines NDEBUG.\n"
                '            undef_macros=["NDEBUG"],\n'
                '            include_dirs=["src"],\n'
            ),
        ),
    )
    for before, after in replacements:
        if after in source:
            continue
        if source.count(before) != 1:
            raise RuntimeError(
                "Tree-sitter's setup.py template changed; review Python configuration"
            )
        source = source.replace(before, after, 1)
    return source


if __name__ == "__main__":
    setup = Path(__file__).with_name("setup.py")
    original = setup.read_text(encoding="utf-8")
    configured = configure(original)
    if configured != original:
        setup.write_text(configured, encoding="utf-8")
