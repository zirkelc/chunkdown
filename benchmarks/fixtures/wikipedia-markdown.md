---
title: Markdown
source: https://en.wikipedia.org/wiki/Markdown
license: CC BY-SA 4.0
---

# Markdown

**Markdown** is a [lightweight markup language](https://en.wikipedia.org/wiki/Lightweight_markup_language) for creating [formatted text](https://en.wikipedia.org/wiki/Formatted_text) using a [plain-text editor](https://en.wikipedia.org/wiki/Text_editor). [John Gruber](https://en.wikipedia.org/wiki/John_Gruber) created Markdown in 2004 as an easy-to-read [markup language](https://en.wikipedia.org/wiki/Markup_language). Markdown is widely used for [blogging](https://en.wikipedia.org/wiki/Blog), [instant messaging](https://en.wikipedia.org/wiki/Instant_messaging), and [large language models](https://en.wikipedia.org/wiki/Large_language_models), and also used elsewhere in [online forums](https://en.wikipedia.org/wiki/Online_forums), [collaborative software](https://en.wikipedia.org/wiki/Collaborative_software), [documentation](https://en.wikipedia.org/wiki/Documentation) pages, and [readme files](https://en.wikipedia.org/wiki/README).

The initial description of Markdown contained ambiguities and raised unanswered questions, causing implementations to both intentionally and accidentally diverge from the original version. This was addressed in 2014 when long-standing Markdown contributors released [CommonMark](https://en.wikipedia.org/wiki/Markdown#CommonMark), an unambiguous specification and test suite for Markdown.

## History

Markdown was inspired by pre-existing [conventions](https://en.wikipedia.org/wiki/Convention_(norm)) for marking up [plain text](https://en.wikipedia.org/wiki/Plain_text) in [email](https://en.wikipedia.org/wiki/Email) and [usenet](https://en.wikipedia.org/wiki/Usenet) posts, such as the earlier markup languages [setext](https://en.wikipedia.org/wiki/Setext) (c. 1992), [Textile](https://en.wikipedia.org/wiki/Textile_(markup_language)) (c. 2002), and [reStructuredText](https://en.wikipedia.org/wiki/ReStructuredText) (c. 2002).

In 2002, [Aaron Swartz](https://en.wikipedia.org/wiki/Aaron_Swartz) created [atx](https://en.wikipedia.org/wiki/Atx_(markup_language)) and referred to it as "the true structured text format". Gruber created the Markdown language in 2004 with Swartz as his "sounding board". The goal of the language was to enable people "to write using an easy-to-read and easy-to-write plain text format, optionally convert it to structurally valid [XHTML](https://en.wikipedia.org/wiki/XHTML) (or [HTML](https://en.wikipedia.org/wiki/HTML))".

Another key design goal was _readability_, that the language be readable as-is, without looking like it has been marked up with tags or formatting instructions, unlike text formatted with "heavier" [markup languages](https://en.wikipedia.org/wiki/Markup_language), such as [Rich Text Format](https://en.wikipedia.org/wiki/Rich_Text_Format) (RTF), HTML, or even [wikitext](https://en.wikipedia.org/wiki/Wikitext), each of which have obvious in-line tags and formatting instructions which can make the text more difficult for humans to read.

Gruber wrote a [Perl](https://en.wikipedia.org/wiki/Perl) script, `Markdown.pl`, which converts marked-up text input to valid, [well-formed](https://en.wikipedia.org/wiki/Well-formed_document) XHTML or HTML, encoding angle brackets (`<`, `>`) and [ampersands](https://en.wikipedia.org/wiki/Ampersand) (`&`), which would be misinterpreted as special characters in those languages. It can take the role of a standalone script, a plugin for [Blosxom](https://en.wikipedia.org/wiki/Blosxom) or [Movable Type](https://en.wikipedia.org/wiki/Movable_Type), or of a text filter for [BBEdit](https://en.wikipedia.org/wiki/BBEdit).

## Rise and divergence

As Markdown's popularity grew rapidly, many Markdown [implementations](https://en.wikipedia.org/wiki/Implementation) appeared, driven mostly by the need for additional features such as [tables](https://en.wikipedia.org/wiki/Table_(information)), [footnotes](https://en.wikipedia.org/wiki/Note_(typography)), definition lists, and Markdown inside HTML blocks.

The behavior of some of these diverged from the reference implementation, as Markdown was only characterised by an informal [specification](https://en.wikipedia.org/wiki/Specification_(technical_standard)) and a [Perl](https://en.wikipedia.org/wiki/Perl) implementation for conversion to HTML.

At the same time, a number of ambiguities in the informal specification had attracted attention. These issues spurred the creation of tools such as Babelmark to compare the output of various implementations, and an effort by some developers of Markdown [parsers](https://en.wikipedia.org/wiki/Parsing) for standardization. However, Gruber has argued that complete standardization would be a mistake: "Different sites (and people) have different needs. No one syntax would make all happy."

Gruber avoided using curly braces in Markdown to unofficially reserve them for implementation-specific extensions.

## CommonMark

Standardization

In 2012, a group of people, including [Jeff Atwood](https://en.wikipedia.org/wiki/Jeff_Atwood) and [John MacFarlane](https://en.wikipedia.org/wiki/John_MacFarlane_(philosopher)), launched what Atwood characterised as a standardization effort.

A community website now aims to "document various tools and resources available to document authors and developers, as well as implementors of the various Markdown implementations".

Name

In September 2014, Gruber objected to the usage of "Markdown" in the name of this effort and it was rebranded as "CommonMark". CommonMark.org published several versions of a specification, reference implementation, test suite, and "\[plans\] to announce a finalized 1.0 spec and test suite in 2019". A finalized 1.0 spec has not been released, as major issues still remain unsolved.

Adoption

Nonetheless, several websites and projects have adopted CommonMark, including [Codeberg](https://en.wikipedia.org/wiki/Codeberg), [Discourse](https://en.wikipedia.org/wiki/Discourse_(software)), [GitHub](https://en.wikipedia.org/wiki/GitHub), [GitLab](https://en.wikipedia.org/wiki/GitLab), [Reddit](https://en.wikipedia.org/wiki/Reddit), [Qt](https://en.wikipedia.org/wiki/Qt_(software)), [Stack Exchange](https://en.wikipedia.org/wiki/Stack_Exchange) ([Stack Overflow](https://en.wikipedia.org/wiki/Stack_Overflow)), and [Swift](https://en.wikipedia.org/wiki/Swift_(programming_language)).

In March 2016, two relevant informational Internet [RFCs](https://en.wikipedia.org/wiki/Request_for_Comments) were published:

-   RFC [7763](https://www.rfc-editor.org/rfc/rfc7763) – "" _Informational._

    Introduces [MIME](https://en.wikipedia.org/wiki/MIME) type `text/markdown`.

-   RFC [7764](https://www.rfc-editor.org/rfc/rfc7764) – "" _Informational._

    Discusses and registers the variants [MultiMarkdown](https://en.wikipedia.org/wiki/MultiMarkdown), [GitHub Flavored Markdown](https://en.wikipedia.org/wiki/Markdown#GFM) (GFM), [Pandoc](https://en.wikipedia.org/wiki/Pandoc), and Markdown Extra (among others).

## Variants

Websites including [Bitbucket](https://en.wikipedia.org/wiki/Bitbucket), [Diaspora](https://en.wikipedia.org/wiki/Diaspora_(social_network)), [Discord](https://en.wikipedia.org/wiki/Discord), [GitHub](https://en.wikipedia.org/wiki/Markdown#GFM), [OpenStreetMap](https://en.wikipedia.org/wiki/OpenStreetMap), [Reddit](https://en.wikipedia.org/wiki/Reddit), [SourceForge](https://en.wikipedia.org/wiki/SourceForge) and [Stack Exchange](https://en.wikipedia.org/wiki/Stack_Exchange) use variants of Markdown to make discussions between users easier.

Depending on implementation, basic inline [HTML tags](https://en.wikipedia.org/wiki/HTML_tag) may be supported.

Italic text may be implemented by `_underscores_` or `*single-asterisks*`.

Many platforms implement spoiler formatting that hides text until hovered, clicked or tapped. The most common markup is ||spoiler|| used by Discord, Telegram, various Matrix clients, now defunct Guilded, a forum called Flarum, a NodeBB plugin, the imageboard engine JSChan and possibly more.

### GitHub Flavored Markdown

[GitHub](https://en.wikipedia.org/wiki/GitHub) had been using its own variant of Markdown since as early as 2009, which added support for additional formatting such as tables and nesting [block content](https://en.wikipedia.org/wiki/HTML_element#Block_elements) inside list elements, as well as GitHub-specific features such as auto-linking references to commits, issues, usernames, etc.

In 2017, GitHub released a formal specification of its [GitHub Flavored Markdown](https://github.github.com/gfm/) (GFM) that is based on [CommonMark](https://en.wikipedia.org/wiki/CommonMark). It is a [strict superset](https://en.wikipedia.org/wiki/Superset) of CommonMark, following its specification exactly except for tables, [strikethrough](https://en.wikipedia.org/wiki/Strikethrough), [autolinks](https://en.wikipedia.org/wiki/Automatic_hyperlinking) and task lists, which GFM adds as extensions.

Accordingly, GitHub also changed the parser used on their sites, which required that some documents be changed. For instance, GFM now requires that the [hash symbol](https://en.wikipedia.org/wiki/Number_sign) that creates a heading be separated from the heading text by a space character.

### Markdown Extra

Markdown Extra is a [lightweight markup language](https://en.wikipedia.org/wiki/Lightweight_markup_language) based on Markdown implemented in [PHP](https://en.wikipedia.org/wiki/PHP) (originally), [Python](https://en.wikipedia.org/wiki/Python_(programming_language)) and [Ruby](https://en.wikipedia.org/wiki/Ruby_(programming_language)). It adds the following features that are not available with regular Markdown:

-   Markdown markup inside [HTML](https://en.wikipedia.org/wiki/HTML) blocks
-   Elements with id/class attribute
-   "Fenced code blocks" that span multiple lines of code
-   Tables
-   Definition lists
-   Footnotes
-   Abbreviations

Markdown Extra is supported in some [content management systems](https://en.wikipedia.org/wiki/Content_management_system) such as [Drupal](https://en.wikipedia.org/wiki/Drupal), [Grav (CMS)](https://en.wikipedia.org/wiki/Grav_(CMS)), [Textpattern CMS](https://en.wikipedia.org/wiki/Textpattern) and [TYPO3](https://en.wikipedia.org/wiki/TYPO3).

## Examples

| Text using Markdown syntax | Corresponding HTML produced by a Markdown processor | Text viewed in a browser |
| --- | --- | --- |
| Heading \======= Sub-heading \----------- \# Alternative heading \## Alternative sub-heading Paragraphs are separated by a blank line. Two spaces at the end of a line produce a line break. | <h1\>Heading</h1\> <h2\>Sub-heading</h2\> <h1\>Alternative heading</h1\> <h2\>Alternative sub-heading</h2\> <p\>Paragraphs are separated by a blank line.</p\> <p\>Two spaces at the end of a line<br /> produce a line break.</p\> | Heading Sub-heading Alternative heading Alternative sub-heading Paragraphs are separated by a blank line. Two spaces at the end of a line produce a line break. |
| Text attributes \_italic\_, \*\*bold\*\*, \`monospace\`. Horizontal rule: --- | <p\>Text attributes <em\>italic</em\>, <strong\>bold</strong\>, <code\>monospace</code\>.</p\> <p\>Horizontal rule:</p\> <hr /> | Text attributes _italic_, **bold**, `monospace`. Horizontal rule: * * * |
| Bullet lists nested within numbered list: 1. fruits \* apple \* banana 2. vegetables \- carrot \- broccoli | <p\>Bullet lists nested within numbered list:</p\> <ol\> <li\>fruits <ul\> <li\>apple</li\> <li\>banana</li\> </ul\></li\> <li\>vegetables <ul\> <li\>carrot</li\> <li\>broccoli</li\> </ul\></li\> </ol\> | Bullet lists nested within numbered list: 1.  fruits -   apple -   banana 2.  vegetables -   carrot -   broccoli |
| A \[link\](http://example.com). !\[Image\](Icon-pictures.png "icon") \> Markdown uses email-style characters for blockquoting. \> \> Multiple paragraphs need to be prepended individually. Most inline <abbr title="Hypertext Markup Language">HTML</abbr> tags are supported. | <p\>A <a href\="http://example.com"\>link</a\>.</p\> <p\><img alt\="Image" title\="icon" src\="Icon-pictures.png" /></p\> <blockquote\> <p\>Markdown uses email-style characters for blockquoting.</p\> <p\>Multiple paragraphs need to be prepended individually.</p\> </blockquote\> <p\>Most inline <abbr title\="Hypertext Markup Language"\>HTML</abbr\> tags are supported.</p\> | A [link](http://example.com/). > Markdown uses email-style characters for blockquoting. > > Multiple paragraphs need to be prepended individually. Most inline HTML tags are supported. |

## Implementations

Implementations of Markdown are available for over a dozen [programming languages](https://en.wikipedia.org/wiki/Programming_language); in addition, many [applications](https://en.wikipedia.org/wiki/Application_software), platforms and [frameworks](https://en.wikipedia.org/wiki/Software_framework) support Markdown. For example, Markdown [plugins](https://en.wikipedia.org/wiki/Plug-in_(computing)) exist for every major [blogging](https://en.wikipedia.org/wiki/Blog) platform.

While Markdown is a minimal markup language and is read and edited with a normal [text editor](https://en.wikipedia.org/wiki/Text_editor), there are specially designed editors that preview the files with styles, which are available for all major platforms. Many general-purpose text and [code editors](https://en.wikipedia.org/wiki/Source-code_editor) have [syntax highlighting](https://en.wikipedia.org/wiki/Syntax_highlighting) plugins for Markdown built into them or available as optional download. Editors may feature a side-by-side preview window or render the code directly in a [WYSIWYG](https://en.wikipedia.org/wiki/WYSIWYG) fashion.
