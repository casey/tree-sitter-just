/**
 * @file Justfile grammar for tree-sitter
 * @author Anshuman Medhi <amedhi@connect.ust.uk>
 * @author Trevor Gross <tmgross@umich.edu>
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license Apache-2.0
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const LOGICAL_OR = token("||");
const LOGICAL_AND = token("&&");
const ESCAPE_SEQUENCE = token(/\\([nrt"\\]|(\r?\n))/);
// Flags to `/usr/bin/env`, anything that starts with a dash
const SHEBANG_ENV_FLAG = token(/-\S*/);

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 */
function comma_sep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

/**
 * Creates a rule to match an array-like structure filled with `item`
 *
 * @param {RuleOrLiteral} rule
 *
 * @return {Rule}
 */
function array(rule) {
  const item = field("element", rule);
  return field(
    "array",
    seq(
      "[",
      optional(field("content", seq(comma_sep1(item), optional(item)))),
      "]",
    ),
  );
}

/**
 * Creates a rule to define a variant of `_setting` for use in `setting`.
 * `rule` is wrapped with `seq(":=", rule)` and if `option` is true,
 * additionally wrapped in an `optional()`. `option` defaults to false.
 *
 * @param {string} setting variant name
 * @param {RuleOrLiteral} rule
 * @param {bool} option (default false) wrap `rule` in `optional()`
 *
 * @return {Rule}
 */
function set_variant(setting, rule, option = false) {
  let item = option
    ? optional(seq(":=", field("right", rule)))
    : seq(":=", field("right", rule));
  return seq(field("left", setting), item);
}

export default grammar({
  name: "just",

  externals: ($) => [
    $._indent,
    $._dedent,
    $._newline,
    $.text,
    $.error_recovery,
  ],

  // Allow comments, backslash-escaped newlines (with optional trailing whitespace),
  // and whitespace anywhere
  extras: ($) => [$.comment, /\\(\n|\r\n)\s*/, /\s/],

  inline: ($) => [
    $._string,
    $._string_indented,
    $._raw_string_indented,
    $._expression_recurse,
    $._AND,
    $._OR,
  ],
  word: ($) => $.identifier,

  rules: {
    // justfile      : item* EOF
    source_file: ($) =>
      seq(optional(seq($.shebang, $._newline)), repeat($._item)),

    // item          : alias
    //               | assignment
    //               | eol
    //               | export
    //               | function
    //               | import
    //               | module
    //               | recipe
    //               | setting
    _item: ($) =>
      choice(
        $.alias,
        $.assignment,
        $.export,
        $.function,
        $.import,
        $.module,
        $.recipe,
        $.setting,
      ),

    // alias         : 'alias' NAME ':=' target eol
    alias: ($) =>
      seq(
        repeat($.attributes),
        "alias",
        field("left", $.identifier),
        ":=",
        field("right", $.target),
        $._newline,
      ),

    // target        : NAME ('::' NAME)*
    target: ($) => seq($.identifier, repeat(seq("::", $.identifier))),

    // assignment    : NAME ':=' expression eol
    assignment: ($) =>
      seq(
        field("left", $.identifier),
        ":=",
        field("right", $.expression),
        $._newline,
      ),

    // export        : 'export' assignment
    export: ($) => seq("export", $.assignment),

    // import        : 'import' '?'? string? eol
    import: ($) => seq("import", optional("?"), optional($.string), $._newline),

    // module        : 'mod' '?'? NAME string? eol
    module: ($) =>
      seq(
        "mod",
        optional("?"),
        field("name", $.identifier),
        optional($.string),
        $._newline,
      ),

    // set           : 'set' setting eol
    setting: ($) => seq("set", $._setting, $._newline),

    // setting       : 'allow-duplicate-recipes' boolean?
    //               | 'allow-duplicate-variables' boolean?
    //               | 'dotenv-filename' ':=' string
    //               | 'dotenv-load' boolean?
    //               | 'dotenv-path' ':=' string
    //               | 'dotenv-required' boolean?
    //               | 'export' boolean?
    //               | 'fallback' boolean?
    //               | 'ignore-comments' boolean?
    //               | 'positional-arguments' boolean?
    //               | 'script-interpreter' ':=' string_list
    //               | 'quiet' boolean?
    //               | 'shell' ':=' string_list
    //               | 'tempdir' ':=' string
    //               | 'unstable' boolean?
    //               | 'windows-powershell' boolean?
    //               | 'windows-shell' ':=' string_list
    //               | 'working-directory' ':=' string
    _setting: ($) =>
      choice(
        set_variant("allow-duplicate-recipes", $.boolean, true),
        set_variant("allow-duplicate-variables", $.boolean, true),
        set_variant("dotenv-filename", $.string),
        set_variant("dotenv-load", $.boolean, true),
        set_variant("dotenv-path", $.string),
        set_variant("dotenv-required", $.boolean, true),
        set_variant("export", $.boolean, true),
        set_variant("fallback", $.boolean, true),
        set_variant("ignore-comments", $.boolean, true),
        set_variant("positional-arguments", $.boolean, true),
        set_variant("script-interpreter", $.string_list),
        set_variant("quiet", $.boolean, true),
        set_variant("shell", $.string_list),
        set_variant("tempdir", $.string),
        set_variant("unstable", $.boolean, true),
        set_variant("windows-powershell", $.boolean, true),
        set_variant("windows-shell", $.string_list),
        set_variant("working-directory", $.string),
      ),

    // function      : NAME '(' parameters? ')' ':=' expression
    function: ($) =>
      seq(
        field("name", $.identifier),
        "(",
        optional(field("parameters", $.function_parameters)),
        ")",
        ":=",
        field("body", $.expression),
      ),

    // parameters    : NAME ( ',' NAME )* ','?
    function_parameters: ($) =>
      seq($.identifier, repeat(seq(",", $.identifier)), optional(",")),

    // boolean       : ':=' ('true' | 'false')
    boolean: (_) => choice("true", "false"),

    // expression    : disjunct || expression
    //               | disjunct
    expression: ($) => $._expression_inner,

    // disjunct      : conjunct && disjunct
    //               | conjunct
    _disjunct: ($) =>
      prec.left(seq($._conjunct, optional(seq($._AND, $._expression_recurse)))),

    // conjunct      : 'if' condition '{' expression '}' 'else' '{' expression '}'
    //               | 'assert' '(' condition ',' expression ')'
    //               | '/' expression
    //               | value '/' expression
    //               | value '+' expression
    //               | value
    _conjunct: ($) =>
      choice(
        $.if_expression,
        $.assert,
        seq("/", $._expression_recurse),
        prec.left(1, seq($.value, "/", $._expression_recurse)),
        prec.left(2, seq($.value, "+", $._expression_recurse)),
        $.value,
      ),

    assert: ($) =>
      seq(
        "assert",
        "(",
        field("check", $.condition),
        ",",
        field("message", $.expression),
        ")",
      ),

    _expression_inner: ($) =>
      prec.left(seq($._disjunct, optional(seq($._OR, $._expression_recurse)))),

    // We can't mark `_expression_inner` inline because it causes an infinite
    // loop at generation, so we just alias it.
    _expression_recurse: ($) => alias($._expression_inner, "expression"),

    if_expression: ($) =>
      seq(
        "if",
        $.condition,
        field("consequence", $._braced_expr),
        repeat(field("alternative", $.else_if_clause)),
        field("alternative", $.else_clause),
      ),

    else_if_clause: ($) => seq("else", "if", $.condition, $._braced_expr),

    else_clause: ($) => seq("else", $._braced_expr),

    _braced_expr: ($) => seq("{", field("body", $.expression), "}"),

    // condition     : expression '==' expression
    //               | expression '!=' expression
    //               | expression '=~' expression
    condition: ($) =>
      choice(
        // Future?
        // seq($.expression, $._OR, $.expression),
        // seq($.expression, $._AND, $.expression),
        seq($.expression, "==", $.expression),
        seq($.expression, "!=", $.expression),
        seq($.expression, "=~", choice($.regex_literal, $.expression)),
        // verify whether this is valid
        $.expression,
      ),

    // Capture this special for injections
    regex_literal: ($) => prec(1, $.string),

    // value         : NAME '(' sequence? ')'
    //               | BACKTICK
    //               | INDENTED_BACKTICK
    //               | NAME
    //               | string
    //               | '(' expression ')'
    value: ($) =>
      prec.left(
        choice(
          $.function_call,
          $.external_command,
          $.identifier,
          $.string,
          $.numeric_error,
          seq("(", $.expression, ")"),
        ),
      ),

    function_call: ($) =>
      seq(
        field("name", $.identifier),
        "(",
        optional(field("arguments", $.sequence)),
        ")",
      ),

    external_command: ($) =>
      choice(seq($._backticked), seq($._indented_backticked)),

    // sequence      : expression ',' sequence
    //               | expression ','?
    sequence: ($) => comma_sep1($.expression),

    // Key=value argument for attributes like [arg("x", pattern='\d+')]
    attribute_kv_argument: ($) =>
      seq(field("key", $.identifier), "=", field("value", $.string)),

    // This is seemingly incorrect with what is actually possible, hence the
    // attribute_kv_argument above.
    // attribute     : NAME
    //               | NAME ':' string
    //               | NAME '(' string (',' string)* ')'
    attribute: ($) =>
      seq(
        $.identifier,
        optional(
          choice(
            seq(":", field("argument", $.string)),
            seq(
              "(",
              field(
                "argument",
                comma_sep1(
                  choice($.string, $.identifier, $.attribute_kv_argument),
                ),
              ),
              ")",
            ),
          ),
        ),
      ),

    // attributes    : '[' attribute (',' attribute)* ']' eol
    attributes: ($) => seq("[", comma_sep1($.attribute), "]", $._newline),

    // A complete recipe
    // recipe        : attributes* '@'? NAME parameter* variadic? ':' dependencies eol body?
    recipe: ($) =>
      seq(
        repeat($.attributes),
        $.recipe_header,
        $._newline,
        optional($.recipe_body),
      ),

    recipe_header: ($) =>
      seq(
        optional("@"),
        field("name", choice($.identifier, alias("import", $.identifier))),
        optional($.parameters),
        ":",
        optional($.dependencies),
      ),

    parameters: ($) =>
      seq(repeat($.parameter), choice($.parameter, $.variadic)),

    // parameter     : '$'? NAME
    //               | '$'? NAME '=' value
    parameter: ($) =>
      seq(
        optional("$"),
        field("name", $.identifier),
        optional(seq("=", field("default", $.value))),
      ),

    // variadic      : '*' parameter
    //               | '+' parameter
    variadic: ($) => seq(field("kleene", choice("*", "+")), $.parameter),

    // dependencies  : dependency* ('&&' dependency+)?
    dependencies: ($) => repeat1(seq(optional("&&"), $.dependency)),

    // dependency    : target
    //               | '(' target expression* ')'
    dependency: ($) => choice(field("name", $.target), $.dependency_expression),

    dependency_expression: ($) =>
      seq("(", field("name", $.target), repeat($.expression), ")"),

    // body          : INDENT line+ DEDENT
    recipe_body: ($) =>
      seq(
        $._indent,
        optional(seq(field("shebang", $.shebang), $._newline)),
        repeat(choice(seq($.recipe_line, $._newline), $._newline)),
        $._dedent,
      ),

    // line          : LINE LINE_PREFIX? (TEXT | interpolation)+ NEWLINE
    //               | NEWLINE
    recipe_line: ($) =>
      seq(
        optional($.recipe_line_prefix),
        repeat1(choice($.text, $.interpolation)),
      ),

    recipe_line_prefix: (_) => choice("@-", "-@", "@", "-", "?"),

    // Any shebang. Needs a named field to apply injection queries correctly.
    shebang: ($) =>
      seq(/#![ \t]*/, choice($._shebang_with_lang, $._opaque_shebang)),

    // Shebang with a nested `language` token that we can extract
    _shebang_with_lang: ($) =>
      seq(
        /\S*\//,
        optional(seq("env", repeat(SHEBANG_ENV_FLAG))),
        alias($.identifier, $.language),
        /.*/,
      ),

    // Fallback shebang, any string
    _opaque_shebang: (_) => /[^/\n]+/,

    // string_list   : '[' string (',' string)* ','? ']'
    string_list: ($) => seq("[", comma_sep1($.string), optional(","), "]"),

    // string        : 'x'? STRING
    //               | 'x'? INDENTED_STRING
    //               | 'x'? RAW_STRING
    //               | 'x'? INDENTED_RAW_STRING
    string: ($) =>
      choice(
        $._string_indented,
        $._raw_string_indented,
        $._string,
        // _raw_string, can't be written as a separate inline for osm reason
        /[xf]?'[^']*'/,
      ),

    _raw_string_indented: ($) => seq(/[xf]?'''/, repeat(/./), "'''"),
    _string: ($) =>
      seq(/[xf]?"/, repeat(choice($.escape_sequence, /[^\\"]+/)), '"'),
    // We need try two separate munches so neither escape sequences nor
    // potential closing quotes get eaten.
    _string_indented: ($) =>
      seq(
        /[xf]?"""/,
        repeat(choice($.escape_sequence, /[^\\]?[^\\"]+/)),
        '"""',
      ),

    escape_sequence: (_) => ESCAPE_SEQUENCE,

    _backticked: ($) => seq("`", optional($.command_body), "`"),
    _indented_backticked: ($) => seq("```", optional($.command_body), "```"),

    command_body: ($) => repeat1(choice($.interpolation, /./)),

    // interpolation : '{{' expression '}}'
    interpolation: ($) => seq("{{", $.expression, "}}"),

    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    // Numbers aren't allowed as values, but we capture them anyway as errors so
    // they don't mess up the whole syntax
    numeric_error: (_) => /(\d+\.\d*|\d+)/,

    // `# ...` comment
    comment: (_) => token(prec(-1, /#.*/)),

    // logical OR operator
    _OR: (_) => LOGICAL_OR,

    // logical AND operator
    _AND: (_) => LOGICAL_AND,
  },
});
