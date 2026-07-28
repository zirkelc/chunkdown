---
title: Python
source: https://en.wikipedia.org/wiki/Python_(programming_language)
license: CC BY-SA 4.0
---

# Python

**Python** is a [high-level](https://en.wikipedia.org/wiki/High-level_programming_language), [general-purpose programming language](https://en.wikipedia.org/wiki/General-purpose_programming_language) that emphasizes [code readability](https://en.wikipedia.org/wiki/Code_readability), simplicity, and ease-of-writing with the use of [significant indentation](https://en.wikipedia.org/wiki/Significant_indentation), an extensive ("batteries-included") [standard library](https://en.wikipedia.org/wiki/Standard_library), and [garbage collection](https://en.wikipedia.org/wiki/Garbage_collection_(computer_science)). Python supports multiple [programming paradigms](https://en.wikipedia.org/wiki/Programming_paradigm) but with an emphasis on [object-oriented programming](https://en.wikipedia.org/wiki/Object-oriented_programming) and [dynamic typing](https://en.wikipedia.org/wiki/Dynamic_typing).

[Guido van Rossum](https://en.wikipedia.org/wiki/Guido_van_Rossum) began working on Python in the late 1980s as a successor to the [ABC](https://en.wikipedia.org/wiki/ABC_(programming_language)) programming language. Python 3.0, released in 2008, was a major revision and not completely [backward-compatible](https://en.wikipedia.org/wiki/Backward-compatible) with earlier versions. Beginning with Python 3.5, capabilities and keywords for typing were added to the language, allowing optional [static typing](https://en.wikipedia.org/wiki/Static_typing). As of 2026, the [Python Software Foundation](https://en.wikipedia.org/wiki/Python_Software_Foundation) supports Python 3.10, 3.11, 3.12, 3.13, and 3.14, following the project's annual release cycle and five-year support policy. Python 3.15 is currently in the beta development phase, and the stable release is expected to launch in October 2026. Earlier versions in the 3.x series have reached end-of-life and no longer receive security updates.

Python is widely taught as an introductory programming language.

## History

Python was conceived in the late 1980s by [Guido van Rossum](https://en.wikipedia.org/wiki/Guido_van_Rossum) at [Centrum Wiskunde & Informatica](https://en.wikipedia.org/wiki/Centrum_Wiskunde_&_Informatica) (CWI) in the [Netherlands](https://en.wikipedia.org/wiki/Netherlands). It was designed as a successor to the [ABC](https://en.wikipedia.org/wiki/ABC_(programming_language)) programming language, which was inspired by [SETL](https://en.wikipedia.org/wiki/SETL), capable of [exception handling](https://en.wikipedia.org/wiki/Exception_handling) and interfacing with the [Amoeba](https://en.wikipedia.org/wiki/Amoeba_(operating_system)) operating system. Python implementation began in December 1989. Van Rossum first released it in 1991 as Python 0.9.0. Van Rossum assumed sole responsibility for the project, as the lead developer, until 12 July 2018, when he announced his "permanent vacation" from responsibilities as Python's "[benevolent dictator for life](https://en.wikipedia.org/wiki/Benevolent_dictator_for_life)" (BDFL); this title was bestowed on him by the Python community to reflect his long-term commitment as the project's chief decision-maker. In January 2019, active Python core developers elected a five-member Steering Council to lead the project.

The name _Python_ derives from the British comedy series _[Monty Python's Flying Circus](https://en.wikipedia.org/wiki/Monty_Python's_Flying_Circus)_. (See [§ Naming](https://en.wikipedia.org/wiki/Python_(programming_language)#Naming).)

Python 2.0 was released on 16 October 2000, featuring many new features such as [list comprehensions](https://en.wikipedia.org/wiki/List_comprehension), [cycle-detecting](https://en.wikipedia.org/wiki/Cycle_detection) garbage collection, [reference counting](https://en.wikipedia.org/wiki/Reference_counting), and [Unicode](https://en.wikipedia.org/wiki/Unicode) support. Python 2.7's [end-of-life](https://en.wikipedia.org/wiki/End-of-life_product) was initially set for 2015, and then postponed to 2020 out of concern that a large body of existing code could not easily be forward-ported to Python 3. It no longer receives security patches or updates. While Python 2.7 and older versions are officially unsupported, a different unofficial Python implementation, [PyPy](https://en.wikipedia.org/wiki/PyPy), continues to support Python 2, i.e., "2.7.18+" (plus 3.11), with the plus signifying (at least some) "[backported](https://en.wikipedia.org/wiki/Backported) security updates".

Python 3.0 was released on 3 December 2008, and was a major revision and not completely [backward-compatible](https://en.wikipedia.org/wiki/Backward-compatible) with earlier versions, with some new semantics and changed syntax. Python 2.7.18, released in 2020, was the last release of Python 2. Several releases in the Python 3.x series have added new syntax to the language, and made a few (considered very minor) backward-incompatible changes.

As of May 2026, Python 3.14.6 is the latest stable release. All older 3.x versions had a security update down to Python 3.9.24 then again with 3.9.25, the final version in 3.9 series. Python 3.10 is, since November 2025, the oldest supported branch. Python 3.15 has an alpha released, and Android has an official downloadable executable available for Python 3.14. Releases receive two years of full support followed by three years of security support.

## Design philosophy and features

Python is a [multi-paradigm programming language](https://en.wikipedia.org/wiki/Multi-paradigm_programming_language). Object-oriented programming and structured programming are fully supported, and many of their features support functional programming and [aspect-oriented programming](https://en.wikipedia.org/wiki/Aspect-oriented_programming) – including [metaprogramming](https://en.wikipedia.org/wiki/Metaprogramming) and [metaobjects](https://en.wikipedia.org/wiki/Metaobject). Many other paradigms are supported via extensions, including [design by contract](https://en.wikipedia.org/wiki/Design_by_contract) and [logic programming](https://en.wikipedia.org/wiki/Logic_programming). Python is often referred to as a _['glue language'](https://en.wikipedia.org/wiki/Glue_language)_ because it is purposely designed to be able to integrate components written in other languages.

Python uses dynamic typing and a combination of [reference counting](https://en.wikipedia.org/wiki/Reference_counting) and a cycle-detecting garbage collector for [memory management](https://en.wikipedia.org/wiki/Memory_management). It uses dynamic [name resolution](https://en.wikipedia.org/wiki/Name_resolution_(programming_languages)) ([late binding](https://en.wikipedia.org/wiki/Late_binding)), which binds method and variable names during program execution.

Python's design offers some support for functional programming in the "[Lisp](https://en.wikipedia.org/wiki/Lisp_(programming_language)) tradition". It has `filter`, `map`, and `reduce` functions; [list comprehensions](https://en.wikipedia.org/wiki/List_comprehension), [dictionaries](https://en.wikipedia.org/wiki/Associative_array), [sets](https://en.wikipedia.org/wiki/Set_(mathematics)), and [generator](https://en.wikipedia.org/wiki/Generator_(computer_programming)) expressions. The standard library has two modules (`itertools` and `functools`) that implement functional tools borrowed from [Haskell](https://en.wikipedia.org/wiki/Haskell) and [Standard ML](https://en.wikipedia.org/wiki/Standard_ML).

Python's core philosophy is summarized in the [Zen of Python](https://en.wikipedia.org/wiki/Zen_of_Python) (PEP 20) written by [Tim Peters](https://en.wikipedia.org/wiki/Tim_Peters_(software_engineer)), which includes aphorisms such as these:

-   Explicit is better than implicit.
-   Simple is better than complex.
-   Readability counts.
-   Special cases aren't special enough to break the rules.
-   Although practicality beats purity, errors should never pass silently, unless explicitly silenced.
-   There should be one-- and preferably only one --obvious way to do it.

However, Python has received criticism for violating these principles and adding unnecessary language bloat. Responses to these criticisms note that the Zen of Python is a guideline rather than a rule. The addition of some new features had been controversial: Guido van Rossum resigned as _Benevolent Dictator for Life_ after conflict about adding the assignment expression operator in Python 3.8.

Nevertheless, rather than building all functionality into its core, Python was designed to be highly [extensible](https://en.wikipedia.org/wiki/Extensible) through modules. This compact modularity has made it particularly popular as a means of adding programmable interfaces to existing applications. Van Rossum's vision of a small core language with a large standard library and an easily extensible interpreter stemmed from his frustrations with ABC, which represented the opposite approach.

Python claims to strive for a simpler, less-cluttered [syntax](https://en.wikipedia.org/wiki/Syntax_(programming_languages)) and grammar, while giving developers a choice in their coding methodology. Python lacks [`do .. while` loops](https://en.wikipedia.org/wiki/Loop_(statement)#Post-test_loop), which [Rossum](https://en.wikipedia.org/wiki/Guido_Van_Rossum) considered harmful. In contrast to [Perl](https://en.wikipedia.org/wiki/Perl)'s motto "[there is more than one way to do it](https://en.wikipedia.org/wiki/There_is_more_than_one_way_to_do_it)", Python advocates an approach where "there should be one – and preferably only one – obvious way to do it". In practice, however, Python provides many ways to achieve a given goal. There are at least three ways to format a string literal, with no certainty as to which one a programmer should use. [Alex Martelli](https://en.wikipedia.org/wiki/Alex_Martelli) is a [Fellow](https://en.wikipedia.org/wiki/Fellow) at the [Python Software Foundation](https://en.wikipedia.org/wiki/Python_Software_Foundation) and Python book author; he wrote that "To describe something as 'clever' is _not_ considered a compliment in the Python culture."

Python's developers typically prioritize readability over performance. For example, they reject patches to non-critical parts of the [CPython](https://en.wikipedia.org/wiki/CPython) reference implementation that would offer increases in speed that do not justify the cost of clarity and readability. Execution speed can be improved by moving speed-critical functions to extension modules written in languages such as [C](https://en.wikipedia.org/wiki/C_(programming_language)), or by using a [just-in-time compiler](https://en.wikipedia.org/wiki/Just-in-time_compiler) like [PyPy](https://en.wikipedia.org/wiki/PyPy). Also, it is possible to transpile to other languages. However, this approach either fails to achieve the expected speed-up, since Python is a very [dynamic language](https://en.wikipedia.org/wiki/Dynamic_language), or only a restricted subset of Python is compiled (with potential minor semantic changes).

Python is meant to be a fun language to use.  This goal is reflected in the name – a tribute to the British comedy group [Monty Python](https://en.wikipedia.org/wiki/Monty_Python) – and in playful approaches to some tutorials and reference materials. For instance, some code examples use the terms "spam" and "eggs" (in reference to [a Monty Python sketch](https://en.wikipedia.org/wiki/Spam_(Monty_Python))), rather than the typical terms ["foo" and "bar"](https://en.wikipedia.org/wiki/Foobar).

A common [neologism](https://en.wikipedia.org/wiki/Neologism) in the Python community is _pythonic_, which has a broad range of meanings related to program style: Pythonic code may use Python [idioms](https://en.wikipedia.org/wiki/Programming_idiom) well; be natural or show fluency in the language; or conform with Python's minimalist philosophy and emphasis on readability.

### Enhancement Proposals

**Python Enhancement Proposals** are a design document for either providing information to the [Python](https://en.wikipedia.org/wiki/Python_(programming_language)) community, or proposal for new feature in Python. PEPs are intented to explain new processes in Python, provide [naming conventions](https://en.wikipedia.org/wiki/Naming_convention_(programming)) or document the processes in the language. PEPs are overseen by Python Steering Council.

There are 3 kinds of PEPs, with those are being _standards track PEP_, _Informational PEP_ and _Process PEP_s which has their own unique meanings. They were firstly introduced in 2000, inspired by other RfCs (requests for comments) and Desing Enhancement Proposals. Most known PEPs are PEP – 1, PEP – 8, [PEP – 20](https://en.wikipedia.org/wiki/Zen_of_Python), PEP – 257 and others.

## Syntax and semantics

Python is meant to be an easily readable language. Its formatting is visually uncluttered and often uses English keywords where other languages use punctuation. Unlike many other languages, it does not use [curly brackets](https://en.wikipedia.org/wiki/Curly_bracket_programming_language) to delimit blocks, and semicolons after statements are allowed but rarely used. It has fewer syntactic exceptions and special cases than [C](https://en.wikipedia.org/wiki/C_(programming_language)) or [Pascal](https://en.wikipedia.org/wiki/Pascal_(programming_language)).

### Indentation

Python uses [whitespace](https://en.wikipedia.org/wiki/Whitespace_character) indentation, rather than curly brackets or keywords, to delimit [blocks](https://en.wikipedia.org/wiki/Block_(programming)). An increase in indentation comes after certain statements; a decrease in indentation signifies the end of the current block. Thus, the program's visual structure accurately represents its semantic structure. This feature is sometimes termed the [off-side rule](https://en.wikipedia.org/wiki/Off-side_rule). Some other languages use indentation this way; but in most, indentation has no semantic meaning. The recommended indent size is four spaces.

### Statements and control flow

Python's [statements](https://en.wikipedia.org/wiki/Statement_(computer_science)) include the following:

-   The [assignment](https://en.wikipedia.org/wiki/Assignment_(computer_science)) statement, using a single equals sign `=`
-   The `[if](https://en.wikipedia.org/wiki/If-then-else)` statement, which conditionally executes a block of code, along with `[else](https://en.wikipedia.org/wiki/Conditional_(computer_programming)#If–then(–else))` and `elif` (a contraction of `[else if](https://en.wikipedia.org/wiki/Conditional_(computer_programming)#Else_if)`)
-   The `[for](https://en.wikipedia.org/wiki/Foreach#Python)` statement, which iterates over an _iterable_ object, capturing each element to a variable for use by the attached block; the variable is not deleted when the loop finishes
-   The `[while](https://en.wikipedia.org/wiki/While_loop#Python)` statement, which executes a block of code as long as boolean condition is true
-   The `[try](https://en.wikipedia.org/wiki/Exception_handling_syntax#Python)` statement, which allows exceptions raised in its attached code block to be caught and handled by `except` clauses (or new syntax `except*` in Python 3.11 for exception groups); the `try` statement also ensures that clean-up code in a `finally` block is always run regardless of how the block exits
-   The `raise` statement, used to raise a specified exception or re-raise a caught exception
-   The `class` statement, which executes a block of code and attaches its local namespace to a [class](https://en.wikipedia.org/wiki/Class_(computer_science)), for use in object-oriented programming
-   The `def` statement, which defines a [function](https://en.wikipedia.org/wiki/Function_(computer_programming)) or [method](https://en.wikipedia.org/wiki/Method_(computing))
-   The `[with](https://en.wikipedia.org/wiki/Dispose_pattern#Language_constructs)` statement, which encloses a code block within a context manager, allowing [resource-acquisition-is-initialization](https://en.wikipedia.org/wiki/Resource_acquisition_is_initialization) (RAII)-like behavior and replacing a common try/finally idiom Examples of a context include acquiring a [lock](https://en.wikipedia.org/wiki/Lock_(computer_science)) before some code is run, and then releasing the lock; or opening and then closing a [file](https://en.wikipedia.org/wiki/Computer_file)
-   The `[break](https://en.wikipedia.org/wiki/Break_statement)` statement, which exits a loop
-   The `continue` statement, which skips the rest of the current iteration and continues with the next
-   The `del` statement, which removes a variable—deleting the reference from the name to the value, and producing an error if the variable is referred to before it is redefined
-   The `pass` statement, serving as a [NOP](https://en.wikipedia.org/wiki/NOP_(code)) (i.e., no operation), which is syntactically needed to create an empty code block
-   The `[assert](https://en.wikipedia.org/wiki/Assertion_(programming))` statement, used in debugging to check for conditions that should apply
-   The `yield` statement, which returns a value from a [generator](https://en.wikipedia.org/wiki/Generator_(computer_programming)#Python) function (and also an operator); used to implement [coroutines](https://en.wikipedia.org/wiki/Coroutine)
-   The `return` statement, used to return a value from a function
-   The `[import](https://en.wikipedia.org/wiki/Include_directive)` and `from` statements, used to import modules whose functions or variables can be used in the current program. Python 3.15 adds a new functionality to lazily import with a new keyword: "The `lazy` keyword works with both `import` and `from ... import` statements."
-   The `match` and `case` statements, analogous to a [switch statement](https://en.wikipedia.org/wiki/Switch_statement) construct, which compares an expression against one or more cases as a control-flow measure

The assignment statement (`=`) binds a name as a [reference](https://en.wikipedia.org/wiki/Pointer_(computer_programming)) to a separate, dynamically allocated [object](https://en.wikipedia.org/wiki/Object_(computer_science)). Variables may subsequently be rebound at any time to any object. In Python, a variable name is a generic reference holder without a fixed [data type](https://en.wikipedia.org/wiki/Type_system); however, it always refers to _some_ object with a type. This is called [dynamic typing](https://en.wikipedia.org/wiki/Type_system#Dynamic_type_checking_and_runtime_type_information)—in contrast to [statically-typed](https://en.wikipedia.org/wiki/Statically-typed) languages, where each variable may contain only a value of a certain type.

Python does not support [tail call](https://en.wikipedia.org/wiki/Tail_call) optimization or [first-class continuations](https://en.wikipedia.org/wiki/First-class_continuations); according to Van Rossum, the language never will. However, better support for [coroutine](https://en.wikipedia.org/wiki/Coroutine)\-like functionality is provided by extending Python's generators. Before 2.5, generators were [lazy](https://en.wikipedia.org/wiki/Lazy_evaluation) [iterators](https://en.wikipedia.org/wiki/Iterator); data was passed unidirectionally out of the generator. From Python 2.5 on, it is possible to pass data back into a generator function; and from version 3.3, data can be passed through multiple stack levels.

### Expressions

Python's [expressions](https://en.wikipedia.org/wiki/Expression_(computer_science)) include the following:

-   The `+`, `-`, and `*` operators for mathematical addition, subtraction, and multiplication are similar to other languages, but the behavior of division differs. There are two types of division in Python: [floor division](https://en.wikipedia.org/wiki/Floor_division) (or integer division) `//`, and floating-point division `/`. Python uses the `**` operator for exponentiation.
-   Python uses the `+` operator for string concatenation. The language uses the `*` operator for duplicating a string a specified number of times.
-   The `@` infix operator is intended to be used by libraries such as [NumPy](https://en.wikipedia.org/wiki/NumPy) for [matrix multiplication](https://en.wikipedia.org/wiki/Matrix_multiplication).
-   The syntax `:=`, called the "walrus operator", was introduced in Python 3.8. This operator assigns values to variables as part of a larger expression.
-   In Python, `==` compares two objects by value. Python's `is` operator may be used to compare object identities (i.e., comparison by reference), and comparisons may be chained—for example, `a <= b <= c`.
-   Python uses `and`, `or`, and `not` as Boolean operators.
-   Python has a type of expression called a _[list comprehension](https://en.wikipedia.org/wiki/List_comprehension#Python)_, and a more general expression called a _generator expression_.
-   [Anonymous functions](https://en.wikipedia.org/wiki/Anonymous_function) are implemented using [lambda expressions](https://en.wikipedia.org/wiki/Lambda_(programming)); however, there may be only one expression in each body.
-   Conditional expressions are written as `x if c else y`. (This is different in operand order from the `[c ? x : y](https://en.wikipedia.org/wiki/%3F:)` operator common to many other languages.)
-   Python makes a distinction between [lists](https://en.wikipedia.org/wiki/List_(computer_science)) and [tuples](https://en.wikipedia.org/wiki/Tuple). Lists are written as `[1, 2, 3]`, are mutable, and cannot be used as the keys of dictionaries (since dictionary keys must be [immutable](https://en.wikipedia.org/wiki/Immutable) in Python). Tuples, written as `(1, 2, 3)`, are immutable and thus can be used as the keys of dictionaries, provided that all of the tuple's elements are immutable. The `+` operator can be used to concatenate two tuples, which does not directly modify their contents, but produces a new tuple containing the elements of both. For example, given the variable `t` initially equal to `(1, 2, 3)`, executing `t = t + (4, 5)` first evaluates `t + (4, 5)`, which yields `(1, 2, 3, 4, 5)`; this result is then assigned back to `t`—thereby effectively "modifying the contents" of `t` while conforming to the immutable nature of tuple objects. Parentheses are optional for tuples in unambiguous contexts.
-   Python features _sequence unpacking_ where multiple expressions, each evaluating to something assignable (e.g., a variable or a writable property) are associated just as in forming tuple literal; as a whole, the results are then put on the left-hand side of the equal sign in an assignment statement. This statement expects an _iterable_ object on the right-hand side of the equal sign to produce the same number of values as the writable expressions on the left-hand side; while iterating, the statement assigns each of the values produced on the right to the corresponding expression on the left.
-   Python has a "string format" operator `%` that functions analogously to `[printf](https://en.wikipedia.org/wiki/Printf)` format strings in the C language—e.g. `"spam=%s eggs=%d" % ("blah", 2)` evaluates to `"spam=blah eggs=2"`. In Python 2.6+ and 3+, this operator was supplemented by the `format()` method of the `str` class, e.g., `"spam={0} eggs={1}".format("blah", 2)`. Python 3.6 added "f-strings": `spam = "blah"; eggs = 2; f'spam={spam} eggs={eggs}'`.
-   Strings in Python can be [concatenated](https://en.wikipedia.org/wiki/Concatenated) by "adding" them (using the same operator as for adding integers and floats); e.g., `"spam" + "eggs"` returns `"spameggs"`. If strings contain numbers, they are concatenated as strings rather than as integers, e.g. `"2" + "2"` returns `"22"`.
-   Python supports [string literals](https://en.wikipedia.org/wiki/String_literal) in several ways:
    -   Delimited by single or double quotation marks; single and double quotation marks have equivalent functionality (unlike in [Unix shells](https://en.wikipedia.org/wiki/Unix_shell), [Perl](https://en.wikipedia.org/wiki/Perl), and Perl-influenced languages). Both marks use the backslash (`\`) as an [escape character](https://en.wikipedia.org/wiki/Escape_character). [String interpolation](https://en.wikipedia.org/wiki/String_interpolation) became available in Python 3.6 as "formatted string literals".
    -   Triple-quoted, i.e., starting and ending with three single or double quotation marks; this may span multiple lines and function like [here documents](https://en.wikipedia.org/wiki/Here_document) in shells, Perl, and [Ruby](https://en.wikipedia.org/wiki/Ruby_(programming_language)).
    -   [Raw string](https://en.wikipedia.org/wiki/Raw_string) varieties, denoted by prefixing the string literal with `r`. Escape sequences are not interpreted; hence raw strings are useful where literal backslashes are common, such as in [regular expressions](https://en.wikipedia.org/wiki/Regular_expression) and [Windows](https://en.wikipedia.org/wiki/Windows)\-style paths. (Compare "`@`\-quoting" in [C#](https://en.wikipedia.org/wiki/C_Sharp_(programming_language)).)
-   Python has [array index](https://en.wikipedia.org/wiki/Array_index) and [array slicing](https://en.wikipedia.org/wiki/Array_slicing) expressions in lists, which are written as `a[key]`, `a[start:stop]` or `a[start:stop:step]`. Indexes are [zero-based](https://en.wikipedia.org/wiki/Zero-based), and negative indexes are relative to the end. Slices take elements from the _start_ index up to, but not including, the _stop_ index. The (optional) third slice [parameter](https://en.wikipedia.org/wiki/Parameter_(computer_programming)), called _step_ or _stride_, allows elements to be skipped or reversed. Slice indexes may be omitted—for example, `a[:]` returns a copy of the entire list. Each element of a slice is a [shallow copy](https://en.wikipedia.org/wiki/Shallow_copy).

In Python, a distinction between expressions and statements is rigidly enforced, in contrast to languages such as [Common Lisp](https://en.wikipedia.org/wiki/Common_Lisp), [Scheme](https://en.wikipedia.org/wiki/Scheme_(programming_language)), or [Ruby](https://en.wikipedia.org/wiki/Ruby_(programming_language)). This distinction leads to duplicating some functionality, for example:

-   [List comprehensions](https://en.wikipedia.org/wiki/List_comprehensions) vs. `for`\-loops
-   [Conditional](https://en.wikipedia.org/wiki/Conditional_(computer_programming)) expressions vs. `if` blocks
-   The `eval()` vs. `exec()` built-in functions (in Python 2, `exec` is a statement); the former function is for expressions, while the latter is for statements

A statement cannot be part of an expression; because of this restriction, expressions such as list and `dict` comprehensions (and lambda expressions) cannot contain statements. As a particular case, an assignment statement such as `a = 1` cannot be part of the conditional expression of a conditional statement.

### Typing

Python uses [duck typing](https://en.wikipedia.org/wiki/Duck_typing), and it has typed objects but untyped variable names. Type constraints are not checked at definition time; rather, operations on an object may fail at usage time, indicating that the object is not of an appropriate type. Despite being [dynamically typed](https://en.wikipedia.org/wiki/Dynamically_typed), Python is [strongly typed](https://en.wikipedia.org/wiki/Strongly_typed), forbidding operations that are poorly defined (e.g., adding a number and a string) rather than quietly attempting to interpret them.

Python allows programmers to define their own types using [classes](https://en.wikipedia.org/wiki/Class_(computer_science)), most often for [object-oriented programming](https://en.wikipedia.org/wiki/Object-oriented_programming). New [instances](https://en.wikipedia.org/wiki/Object_(computer_science)) of classes are constructed by calling the class, for example, `SpamClass()` or `EggsClass()`); the classes are instances of the [metaclass](https://en.wikipedia.org/wiki/Metaclass) `type` (which is an instance of itself), thereby allowing metaprogramming and [reflection](https://en.wikipedia.org/wiki/Reflective_programming).

Before version 3.0, Python had two kinds of classes, both using the same syntax: _old-style_ and _new-style_. Current Python versions support the semantics of only the new style.

Python supports [optional type annotations](https://en.wikipedia.org/wiki/Optional_typing). These annotations are not enforced by the language, but may be used by external tools such as **mypy** to catch errors. Python includes a module `typing` including several type names for type annotations. Also, mypy supports a Python compiler called mypyc, which leverages type annotations for optimization.

| Type | [Mutability](https://en.wikipedia.org/wiki/Immutable_object) | Description | Syntax examples |
| --- | --- | --- | --- |
| `bool` | immutable | [Boolean value](https://en.wikipedia.org/wiki/Boolean_value) | `True` `False` |
| `bytearray` | mutable | Sequence of [bytes](https://en.wikipedia.org/wiki/Byte) | `bytearray(b'Some ASCII')` `bytearray(b"Some ASCII")` `bytearray([119, 105, 107, 105])` |
| `bytes` | immutable | Sequence of bytes | `b'Some ASCII'` `b"Some ASCII"` `bytes([119, 105, 107, 105])` |
| `complex` | immutable | [Complex number](https://en.wikipedia.org/wiki/Complex_number) with real and imaginary parts | `3+2.7j` `3 + 2.7j` `5j` |
| `dict` | mutable | [Associative array](https://en.wikipedia.org/wiki/Associative_array) (or dictionary) of key and value pairs; can contain mixed types (keys and values); keys must be a hashable type | `{'key1': 1.0, 3: False}` `{}` |
| `types.EllipsisType` | immutable | An [ellipsis](https://en.wikipedia.org/wiki/Ellipsis_(programming_operator)) placeholder to be used as an index in [NumPy](https://en.wikipedia.org/wiki/NumPy) arrays | `...` `Ellipsis` |
| `float` | immutable | 64-bit [double-precision](https://en.wikipedia.org/wiki/Double-precision) [floating-point number](https://en.wikipedia.org/wiki/Floating-point_number) ([IEEE 754](https://en.wikipedia.org/wiki/IEEE_754) number with 53 bits of precision, in all supported versions since CPython 3.11; also in practice in 3.10 and older, though technically there the precision is machine-dependent). Python's built-in type `memoryview` does though support both 64-bit doubles and 32-bit floats, and Python's standard library `struct` module additionally supports 16-bit half-floats. Python packages like NumPy and Pandas may also support 32-bit floats or more, e.g. `numpy.half`; though support for half-floats is often incomplete or non-existent in most packages. 16-bit [bfloat](https://en.wikipedia.org/wiki/Bfloat16_floating-point_format) has support in a few packages. Most Python implementations choose to support the double kind, but some unusual (subset) implementations, such as [MicroPython](https://en.wikipedia.org/wiki/MicroPython) for [embedded programming](https://en.wikipedia.org/wiki/Embedded_programming), support 32-bit IEEE floats as their default float. Users can opt into 64-bit by setting MICROPY\_FLOAT\_IMPL to MICROPY\_FLOAT\_IMPL\_DOUBLE. | `1.33333` |
| `frozenset` | immutable | Unordered [set](https://en.wikipedia.org/wiki/Set_(computer_science)), contains no duplicates; can contain mixed types, if hashable | `frozenset({4.0, 'string', True})` `frozenset()` |
| `int` | immutable | [Integer](https://en.wikipedia.org/wiki/Integer_(computer_science)) of unlimited magnitude (i.e. not using machine integers; e.g. the Python package NumPy uses fixed-sized integers for speedup (and allows different sizes), such as types `numpy.byte` and `numpy.ulonglong`, all such types have a possibility of wrap-around, though less likely the larger it is) | `42` |
| `list` | mutable | [List](https://en.wikipedia.org/wiki/List_(computer_science)), can contain mixed types | `[4.0, 'string', True]` `[]` |
| `types.NoneType` | immutable | An object representing the absence of a value, often called [null](https://en.wikipedia.org/wiki/Null_pointer) in other languages | `None` |
| `types.NotImplementedType` | immutable | A placeholder that can be returned from [overloaded operators](https://en.wikipedia.org/wiki/Operator_overloading) to indicate unsupported operand types | `NotImplemented` |
| `range` | immutable | An _immutable sequence_ of numbers, commonly used for iterating a specific number of times in `for` loops | `range(−1, 10)` `range(10, −5, −2)` |
| `set` | mutable | Unordered [set](https://en.wikipedia.org/wiki/Set_(computer_science)), contains no duplicates; can contain mixed types, if hashable | `{4.0, 'string', True}` `set()` |
| `str` | immutable | A [character string](https://en.wikipedia.org/wiki/Character_string): sequence of Unicode codepoints | `'Wikipedia'` `"Wikipedia"` """Spanning multiple lines""" |
| `tuple` | immutable | [Tuple](https://en.wikipedia.org/wiki/Tuple), can contain mixed types | `(4.0, 'string', True)` `('single element',)` `()` |

### Arithmetic operations

Python includes conventional symbols for arithmetic operators (`+`, `-`, `*`, `/`), the floor-division operator `//`, and the [modulo operator](https://en.wikipedia.org/wiki/Modulo_operator) `%`. (With the modulo operator, a remainder can be negative, e.g., `4 % -3 == -2`.) Python also offers the `**` symbol for [exponentiation](https://en.wikipedia.org/wiki/Exponentiation), e.g. `5**3 == 125` and `9**0.5 == 3.0`, as well as the matrix‑multiplication operator `@`. These operators work as in traditional mathematics; with the same [precedence rules](https://en.wikipedia.org/wiki/Order_of_operations), the [infix](https://en.wikipedia.org/wiki/Infix_notation) operators `+` and `-` can also be [unary](https://en.wikipedia.org/wiki/Unary_operation), to represent positive and negative numbers respectively.

Division between integers produces floating-point results. The behavior of division has changed significantly over time:

-   The current version of Python (i.e., since 3.0) changed the `/` operator to always represent floating-point division, e.g., `5/2 == 2.5`.
-   The floor division `//` operator was introduced, meaning that `7//3 == 2`, `-7//3 == -3`, `7.5//3 == 2.0`, and `-7.5//3 == -3.0`. For Python 2.7, adding the `from __future__ import division` statement allows a module in Python 2.7 to use Python 3.x rules for division (see above).

In Python terms, the `/` operator represents _true division_ (or simply _division_), while the `//` operator represents _floor division._ Before version 3.0, the `/` operator represents _classic division_.

[Rounding](https://en.wikipedia.org/wiki/Rounding) towards negative infinity, though a different method than in most languages, adds consistency to Python. For instance, this rounding implies that the equation `(a + b)//b == a//b + 1` is always true. Also, the rounding implies that the equation `b*(a//b) + a%b == a` is valid for both positive and negative values of `a`. As expected, the result of `a%b` lies in the [half-open interval](https://en.wikipedia.org/wiki/Half-open_interval) \[0, _b_), where `b` is a positive integer; however, maintaining the validity of the equation requires that the result must lie in the interval (_b_, 0\] when `b` is negative.

Python provides a `round` function for rounding a float to the nearest integer. For [tie-breaking](https://en.wikipedia.org/wiki/Rounding#Tie-breaking), Python 3 uses the _round to even_ method: `round(1.5)` and `round(2.5)` both produce `2`. Python versions before 3 used the [round-away-from-zero](https://en.wikipedia.org/wiki/Rounding#Rounding_away_from_zero) method: `round(0.5)` is `1.0`, and `round(-0.5)` is `−1.0`.

Python allows Boolean expressions that contain multiple equality relations to be consistent with general usage in mathematics. For example, the expression `a < b < c` tests whether `a` is less than `b` and `b` is less than `c`. C-derived languages interpret this expression differently: in C, the expression would first evaluate `a < b`, resulting in 0 or 1, and that result would then be compared with `c`.

Python uses [arbitrary-precision arithmetic](https://en.wikipedia.org/wiki/Arbitrary-precision_arithmetic) for all integer operations. The `Decimal` type/class in the `decimal` module provides [decimal floating-point numbers](https://en.wikipedia.org/wiki/Decimal_floating_point) to a pre-defined arbitrary precision with several rounding modes. The `Fraction` class in the `fractions` module provides arbitrary precision for [rational numbers](https://en.wikipedia.org/wiki/Rational_number).

Due to Python's extensive mathematics library and the third-party library [NumPy](https://en.wikipedia.org/wiki/NumPy), the language is frequently used for scientific scripting in tasks such as numerical data processing and manipulation.

### Function syntax

[Functions](https://en.wikipedia.org/wiki/Function_(computer_programming)) are created in Python by using the `def` keyword. A function is defined similarly to how it is called, by first providing the function name and then the required parameters. Here is an example of a function that prints its inputs:

def printer(input1, input2 \= "already there"):
    print(input1)
    print(input2)

printer("hello")

\# Example output:
\# hello
\# already there

To assign a default value to a function parameter in case no actual value is provided at run time, variable-definition syntax can be used inside the function header.

## Code examples

["Hello, World!" program](https://en.wikipedia.org/wiki/"Hello,_World!"_program):

print('Hello, World!')

Program to calculate the [factorial](https://en.wikipedia.org/wiki/Factorial) of a non-negative integer:

text \= input('Type a number, and its factorial will be printed: ')
n \= int(text)
if n < 0:
    raise ValueError('You must enter a non-negative integer')
factorial \= 1
for i in range(2, n + 1):
    factorial \*= i
print(factorial)

## Libraries

Python's large standard library is commonly cited as one of its greatest strengths. For Internet-facing applications, many standard formats and protocols such as [MIME](https://en.wikipedia.org/wiki/MIME) and [HTTP](https://en.wikipedia.org/wiki/HTTP) are supported. The language includes modules for creating [graphical user interfaces](https://en.wikipedia.org/wiki/Graphical_user_interface), connecting to [relational databases](https://en.wikipedia.org/wiki/Relational_database), [generating pseudorandom numbers](https://en.wikipedia.org/wiki/Pseudorandom_number_generator), arithmetic with arbitrary-precision decimals, manipulating [regular expressions](https://en.wikipedia.org/wiki/Regular_expression), and [unit testing](https://en.wikipedia.org/wiki/Unit_testing).

Some parts of the standard library are covered by specifications—for example, the [Web Server Gateway Interface](https://en.wikipedia.org/wiki/Web_Server_Gateway_Interface) (WSGI) implementation `wsgiref` follows PEP 333—but most parts are specified by their code, internal documentation, and [test suites](https://en.wikipedia.org/wiki/Test_suite). However, because most of the standard library is cross-platform Python code, only a few modules must be altered or rewritten for variant implementations.

As of 13 March 2025, the [Python Package Index](https://en.wikipedia.org/wiki/Python_Package_Index) (PyPI), the official repository for third-party Python software, contains over 614,339 packages.

## Development environments

Most Python implementations (including CPython) include a [read–eval–print loop](https://en.wikipedia.org/wiki/Read–eval–print_loop) (REPL); this permits the environment to function as a [command line interpreter](https://en.wikipedia.org/wiki/Command_line_interpreter), with which users enter statements sequentially and receive results immediately.

Also, CPython is bundled with an [integrated development environment (IDE)](https://en.wikipedia.org/wiki/Integrated_development_environment) called [IDLE](https://en.wikipedia.org/wiki/IDLE), which is oriented toward beginners.

Other shells, including [IDLE](https://en.wikipedia.org/wiki/IDLE) and [IPython](https://en.wikipedia.org/wiki/IPython), add additional capabilities such as improved auto-completion, session-state retention, and [syntax highlighting](https://en.wikipedia.org/wiki/Syntax_highlighting).

Standard desktop IDEs include [PyCharm](https://en.wikipedia.org/wiki/PyCharm), [Spyder](https://en.wikipedia.org/wiki/Spyder_(software)), and [Visual Studio Code](https://en.wikipedia.org/wiki/Visual_Studio_Code); there are [web browser](https://en.wikipedia.org/wiki/Web_browser)\-based IDEs, such as the following environments:

-   [Jupyter Notebooks](https://en.wikipedia.org/wiki/Project_Jupyter), an open-source interactive computing platform;
-   [PythonAnywhere](https://en.wikipedia.org/wiki/PythonAnywhere), a browser-based IDE and hosting environment; and
-   Canopy, a commercial IDE from [Enthought](https://en.wikipedia.org/wiki/Enthought) that emphasizes [scientific computing](https://en.wikipedia.org/wiki/Scientific_computing).

## Implementations

### Reference implementation

[CPython](https://en.wikipedia.org/wiki/CPython) is the [reference implementation](https://en.wikipedia.org/wiki/Reference_implementation) of Python. This implementation is written in C; meeting the [C11](https://en.wikipedia.org/wiki/C11_(C_standard_revision)) standard since version 3.11. Older versions use the [C89](https://en.wikipedia.org/wiki/C89_(C_version)) standard with several select [C99](https://en.wikipedia.org/wiki/C99) features, but third-party extensions are not limited to older C versions—e.g., they can be implemented using C11 or C++. CPython [compiles](https://en.wikipedia.org/wiki/Compiler) Python programs into an intermediate [bytecode](https://en.wikipedia.org/wiki/Bytecode), which is then executed by a [virtual machine](https://en.wikipedia.org/wiki/Virtual_machine). CPython is distributed with a large standard library written in a combination of C and native Python.

CPython is available for many platforms, including Windows and most modern [Unix-like](https://en.wikipedia.org/wiki/Unix-like) systems, including macOS (and [Apple M1](https://en.wikipedia.org/wiki/Apple_M1) Macs, since Python 3.9.1, using an experimental installer). Starting with Python 3.9, the Python installer intentionally fails to install on [Windows 7](https://en.wikipedia.org/wiki/Windows_7) and 8; [Windows XP](https://en.wikipedia.org/wiki/Windows_XP) was supported until Python 3.5. Old Python versions unofficially support [VMS](https://en.wikipedia.org/wiki/OpenVMS) (mostly supporting) and [OpenVMS](https://en.wikipedia.org/wiki/OpenVMS) x86-64 has Python 3.10 support. Platform portability was one of Python's earliest priorities. During development of Python 1 and 2, even [OS/2](https://en.wikipedia.org/wiki/OS/2) and [Solaris](https://en.wikipedia.org/wiki/Solaris_(operating_system)) were supported; since that time, support has been dropped for many platforms.

All current Python versions (since 3.7) support only operating systems that feature multithreading, by now supporting not nearly as many operating systems (dropping many outdated) than in the past.

### Limitations of the reference implementation

-   The energy usage of Python with CPython for typically written code is much worse than C by a factor of 75.88.
-   The throughput of Python with CPython for typically written code is worse than C by a factor of 71.9.
-   The average memory usage of CPython for typically written code is worse than C by a factor of 2.4.

### Other implementations

All alternative implementations have at least slightly different semantics. For example, an alternative may include unordered dictionaries, in contrast to other current Python versions. As another example in the larger Python ecosystem, PyPy does not support the full C Python API.

Creating an executable with Python often is done by bundling an entire Python interpreter into the executable, which causes binary sizes to be massive for small programs, yet there exist implementations that are capable of truly compiling Python. Alternative implementations include the following:

-   [PyPy](https://en.wikipedia.org/wiki/PyPy) is a faster, compliant interpreter of Python 2.7 and 3.11. PyPy's [just-in-time compiler](https://en.wikipedia.org/wiki/Just-in-time_compiler) often improves speed significantly relative to CPython, but PyPy does not support some libraries written in C. PyPy offers support for the [RISC-V](https://en.wikipedia.org/wiki/RISC-V) instruction-set architecture.
-   Codon is an implementation with an [ahead-of-time (AOT) compiler](https://en.wikipedia.org/wiki/Ahead-of-time_compilation), which compiles a statically-typed Python-like language whose "syntax and semantics are nearly identical to Python's, there are some notable differences" For example, Codon uses 64-bit machine integers for speed, not arbitrarily as with Python; Codon developers claim that speedups over CPython are usually on the order of ten to a hundred times. Codon compiles to machine code (via [LLVM](https://en.wikipedia.org/wiki/LLVM)) and supports native multithreading. Codon can also compile to Python extension modules that can be imported and used from Python.
-   [MicroPython](https://en.wikipedia.org/wiki/MicroPython) and [CircuitPython](https://en.wikipedia.org/wiki/CircuitPython) are Python 3 variants that are optimized for [microcontrollers](https://en.wikipedia.org/wiki/Microcontroller), including the [Lego Mindstorms EV3](https://en.wikipedia.org/wiki/Lego_Mindstorms_EV3).
-   Pyston is a variant of the Python runtime that uses just-in-time compilation to speed up execution of Python programs.
-   Cinder is a performance-oriented fork of CPython 3.8 that features a number of optimizations, including bytecode inline caching, eager evaluation of coroutines, a method-at-a-time [JIT](https://en.wikipedia.org/wiki/Just-in-time_compilation), and an experimental bytecode compiler.
-   The Snek embedded computing language "is Python-inspired, but it is not Python. It is possible to write Snek programs that run under a full Python system, but most Python programs will not run under Snek." Snek is compatible with 8-bit [AVR microcontrollers](https://en.wikipedia.org/wiki/AVR_microcontrollers) such as [ATmega 328P](https://en.wikipedia.org/wiki/ATmega)\-based Arduino, as well as larger microcontrollers that are compatible with [MicroPython](https://en.wikipedia.org/wiki/MicroPython). Snek is an imperative language that (unlike Python) omits [object-oriented programming](https://en.wikipedia.org/wiki/Object-oriented_programming). Snek supports only one numeric data type, which features 32-bit [single precision](https://en.wikipedia.org/wiki/Single_precision) (resembling [JavaScript](https://en.wikipedia.org/wiki/JavaScript) numbers, though smaller).
-   RustPython is an implementation written in [Rust](https://en.wikipedia.org/wiki/Rust_(programming_language)) language. It aims to be compatible with CPython, including its C-ABI. Currently, it is used in [GrepTimeDB](https://www.greptime.com/product/db) and [Ruff](https://astral.sh/ruff) among other projects.

### Unsupported implementations

[Stackless Python](https://en.wikipedia.org/wiki/Stackless_Python) is a significant fork of CPython that implements [microthreads](https://en.wikipedia.org/wiki/Microthread). This implementation uses the [call stack](https://en.wikipedia.org/wiki/Call_stack) differently, thus allowing massively concurrent programs. PyPy also offers a stackless version.

Just-in-time Python compilers have been developed, but are now unsupported:

-   Google began a project named [Unladen Swallow](https://en.wikipedia.org/wiki/Unladen_Swallow) in 2009: this project aimed to speed up the Python interpreter five-fold by using [LLVM](https://en.wikipedia.org/wiki/LLVM), and improve [multithreading](https://en.wikipedia.org/wiki/Multithreading_(computer_architecture)) capability for scaling to thousands of cores, while typical implementations are limited by the [global interpreter lock](https://en.wikipedia.org/wiki/Global_interpreter_lock).
-   [Psyco](https://en.wikipedia.org/wiki/Psyco) is a discontinued [just-in-time](https://en.wikipedia.org/wiki/Just-in-time_compilation) [specializing](https://en.wikipedia.org/wiki/Run-time_algorithm_specialization) compiler, which integrates with CPython and transforms bytecode to machine code at runtime. The emitted code is specialized for certain [data types](https://en.wikipedia.org/wiki/Data_type) and is faster than standard Python code. Psyco does not support Python 2.7 or later.
-   [PyS60](https://en.wikipedia.org/wiki/PyS60) was a Python 2 interpreter for [Series 60](https://en.wikipedia.org/wiki/Series_60) mobile phones, which was released by [Nokia](https://en.wikipedia.org/wiki/Nokia) in 2005. The interpreter implemented many modules from Python's standard library, as well as additional modules for integration with the [Symbian](https://en.wikipedia.org/wiki/Symbian) operating system. The Nokia [N900](https://en.wikipedia.org/wiki/N900) also supports Python through the [GTK](https://en.wikipedia.org/wiki/GTK) widget library, allowing programs to be written and run on the target device.

### Transpilers to other languages

There are several compilers/[transpilers](https://en.wikipedia.org/wiki/Transpiler) to high-level object languages; the source language is unrestricted Python, a subset of Python, or a language similar to Python:

-   Brython and Transcrypt compile Python to [JavaScript](https://en.wikipedia.org/wiki/JavaScript).
-   [Cython](https://en.wikipedia.org/wiki/Cython) compiles a superset of Python to C. The resulting code can be used with Python via direct C-level API calls into the Python interpreter.
-   PyJL compiles/transpiles a subset of Python to "human-readable, maintainable, and high-performance Julia source code". Despite the developers' performance claims, this is not possible for _arbitrary_ Python code; that is, compiling to a faster language or machine code is known to be impossible in the general case. The semantics of Python might potentially be changed, but in many cases speedup is possible with few or no changes in the Python code. The faster Julia source code can then be used from Python or compiled to machine code.
-   [Nuitka](https://en.wikipedia.org/wiki/Nuitka) compiles Python into C. This compiler works with Python 3.4 to 3.13 (and 2.6 and 2.7) for Python's main supported platforms (and Windows 7 or even Windows XP) and for Android. The compiler developers claim full support for Python 3.10, partial support for Python 3.11 and 3.12, and experimental support for Python 3.13. Nuitka supports macOS including Apple Silicon-based versions. The compiler is free of cost, though it has commercial add-ons (e.g., for hiding source code).
-   [Numba](https://en.wikipedia.org/wiki/Numba) is a JIT compiler that is used from Python; the compiler translates a subset of Python and NumPy code into fast machine code. This tool is enabled by adding a decorator to the relevant Python code.
-   Pythran compiles a subset of Python 3 to C++ ([C++11](https://en.wikipedia.org/wiki/C++11)).
-   [RPython](https://en.wikipedia.org/wiki/RPython) can be compiled to C, and it is used to build the PyPy interpreter for Python.
-   The Python → 11l → C++ transpiler compiles a subset of Python 3 to C++ ([C++17](https://en.wikipedia.org/wiki/C++17)).

There are also specialized compilers:

-   [MyHDL](https://en.wikipedia.org/wiki/MyHDL) is a Python-based [hardware description language](https://en.wikipedia.org/wiki/Hardware_description_language) (HDL) that converts MyHDL code to [Verilog](https://en.wikipedia.org/wiki/Verilog) or [VHDL](https://en.wikipedia.org/wiki/VHDL) code.

Some older projects existed, as well as compilers not designed for use with Python 3.x and related syntax:

-   Google's Grumpy [transpiles](https://en.wikipedia.org/wiki/Transpile) Python 2 to [Go](https://en.wikipedia.org/wiki/Go_(programming_language)). The latest release was in 2017.
-   [IronPython](https://en.wikipedia.org/wiki/IronPython) allows running Python 2.7 programs with the .NET [Common Language Runtime](https://en.wikipedia.org/wiki/Common_Language_Runtime). An [alpha](https://en.wikipedia.org/wiki/Software_release_life_cycle#Alpha) version (released in 2021), is available for "Python 3.4, although features and behaviors from later versions may be included."
-   [Jython](https://en.wikipedia.org/wiki/Jython) compiles Python 2.7 to Java bytecode, allowing the use of Java libraries from a Python program.
-   [Pyrex](https://en.wikipedia.org/wiki/Pyrex_(programming_language)) (last released in 2010) and [Shed Skin](https://en.wikipedia.org/wiki/Shed_Skin) (last released in 2013) compile to C and C++ respectively.

### Performance

A performance comparison among various Python implementations, using a non-numerical (combinatorial) workload, was presented at EuroSciPy '13. In addition, Python's performance relative to other programming languages is benchmarked by [The Computer Language Benchmarks Game](https://en.wikipedia.org/wiki/The_Computer_Language_Benchmarks_Game).

There are several approaches to optimizing Python performance, despite the inherent slowness of an [interpreted language](https://en.wikipedia.org/wiki/Interpreted_language). These approaches include the following strategies or tools:

-   [Just-in-time compilation](https://en.wikipedia.org/wiki/Just-in-time_compilation): Dynamically compiling parts of a Python program during the execution of the program. This technique is used in libraries such as [Numba](https://en.wikipedia.org/wiki/Numba) and [PyPy](https://en.wikipedia.org/wiki/PyPy).
-   [Static compilation](https://en.wikipedia.org/wiki/Compiler): Sometimes, Python code can be compiled into machine code sometime before execution. An example of this approach is [Cython](https://en.wikipedia.org/wiki/Cython), which compiles Python into C.
-   [Concurrency](https://en.wikipedia.org/wiki/Concurrent_computing) and [parallelism](https://en.wikipedia.org/wiki/Parallel_computing): Multiple tasks can be run simultaneously. Python contains modules such as \`multiprocessing\` to support this form of parallelism. Moreover, this approach helps to overcome limitations of the [Global Interpreter Lock](https://en.wikipedia.org/wiki/Global_Interpreter_Lock) (GIL) in CPU tasks.
-   Efficient [data structures](https://en.wikipedia.org/wiki/Data_structures): Performance can also be improved by using data types such as `Set` for membership tests, or `deque` from `collections` for [queue](https://en.wikipedia.org/wiki/Queueing_theory) operations.
-   Performance gains can be observed by utilizing libraries such as [NumPy](https://en.wikipedia.org/wiki/NumPy). Most high performance Python libraries use [C](https://en.wikipedia.org/wiki/C_(programming_language)) or [Fortran](https://en.wikipedia.org/wiki/Fortran) under the hood instead of the Python interpreter.

## Language development

Python's development is conducted mostly through the _Python Enhancement Proposal_ (PEP) process; this process is the primary mechanism for proposing major new features, collecting community input on issues, and documenting Python design decisions. Python coding style is covered in PEP 8. Outstanding PEPs are reviewed and commented on by the Python community and the steering council.

Enhancement of the language corresponds with development of the CPython reference implementation. The mailing list python-dev is the primary forum for the language's development. Specific issues were originally discussed in the [Roundup](https://en.wikipedia.org/wiki/Roundup_(issue_tracker)) [bug tracker](https://en.wikipedia.org/wiki/Bug_tracker) hosted by the foundation. In 2022, all issues and discussions were migrated to [GitHub](https://en.wikipedia.org/wiki/GitHub). Development originally took place on a [self-hosted](https://en.wikipedia.org/wiki/Self-hosting_(web_services)) source-code repository running [Mercurial](https://en.wikipedia.org/wiki/Mercurial), until Python moved to GitHub in January 2017.

CPython's public releases have three types, distinguished by which part of the version number is incremented:

-   _Backward-incompatible versions_, where code is expected to break and must be manually [ported](https://en.wikipedia.org/wiki/Ported). The first part of the version number is incremented. These releases happen infrequently—version 3.0 was released 8 years after 2.0. According to Guido van Rossum, a version 4.0 will probably never exist.
-   _Major or "feature" releases_ are largely compatible with the previous version but introduce new features. The second part of the version number is incremented. Starting with Python 3.9, these releases are expected to occur annually. Each major version is supported by bug fixes for several years after its release.
-   _Bug fix releases_, which introduce no new features, occur approximately every three months; these releases are made when a sufficient number of bugs have been fixed [upstream](https://en.wikipedia.org/wiki/Upstream_(software_development)) since the last release. Security vulnerabilities are also patched in these releases. The third and final part of the version number is incremented.

Many [alpha, beta, and release-candidates](https://en.wikipedia.org/wiki/Beta_release) are also released as previews and for testing before final releases. Although there is a rough schedule for releases, they are often delayed if the code is not ready yet. Python's development team monitors the state of the code by running a large [unit test](https://en.wikipedia.org/wiki/Unit_test) suite during development.

The major [academic conference](https://en.wikipedia.org/wiki/Academic_conference) on Python is [PyCon](https://en.wikipedia.org/wiki/PyCon). Also, there are special Python mentoring programs, such as [PyLadies](https://en.wikipedia.org/wiki/PyLadies).

## Naming

Python's name is inspired by the British comedy group [Monty Python](https://en.wikipedia.org/wiki/Monty_Python), whom Python creator Guido van Rossum enjoyed while developing the language. Monty Python references appear frequently in Python code and culture; for example, the [metasyntactic variables](https://en.wikipedia.org/wiki/Metasyntactic_variable) often used in Python literature are [_spam_ and _eggs_](https://en.wikipedia.org/wiki/Spam_(Monty_Python_sketch)), rather than the traditional [_foo_ and _bar_](https://en.wikipedia.org/wiki/Foobar). Also, the official Python documentation contains various references to Monty Python routines. Python users are sometimes referred to as "Pythonistas".

## Languages influenced by Python

-   [Cobra](https://en.wikipedia.org/wiki/Cobra_(programming_language)) has an _Acknowledgements_ document that lists Python first among influencing languages.
-   [ECMAScript](https://en.wikipedia.org/wiki/ECMAScript) and [JavaScript](https://en.wikipedia.org/wiki/JavaScript) borrowed iterators and [generators](https://en.wikipedia.org/wiki/Generator_(computer_science)) from Python.
-   [Go](https://en.wikipedia.org/wiki/Go_(programming_language)) is designed for "speed of working in a dynamic language like Python".
-   [Julia](https://en.wikipedia.org/wiki/Julia_(programming_language)) was designed to be "as usable for general programming as Python".
-   [Mojo](https://en.wikipedia.org/wiki/Mojo_(programming_language)) is almost a superset of Python.
-   [GDScript](https://en.wikipedia.org/wiki/GDScript) is strongly influenced by Python.
-   [Groovy](https://en.wikipedia.org/wiki/Apache_Groovy), [Boo](https://en.wikipedia.org/wiki/Boo_(programming_language)), [CoffeeScript](https://en.wikipedia.org/wiki/CoffeeScript), [F#](https://en.wikipedia.org/wiki/F_Sharp_(programming_language)), [Nim](https://en.wikipedia.org/wiki/Nim_(programming_language)), [Ruby](https://en.wikipedia.org/wiki/Ruby_(programming_language)), [Swift](https://en.wikipedia.org/wiki/Swift_(programming_language)), and [V](https://en.wikipedia.org/wiki/V_(programming_language)) have been influenced, as well.
