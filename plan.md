I want to plan a refactoring.
The node-type specific splitting for tables, list and possibly other types should be extracted into seperate classes like TableSplitter ListSplitter, etc.
They all implement a single interface Splitter with a few core methods, e.g. split().
The core function chunkdown() should be also refactored into a MarkdownTreeSplitter class and chunkdown() wil simply create this class and return the instance.
The MarkdownTreeSplitter will have a map of node-type to implementing class (TableSplitter, ListSplitter, ...) which could be overriden in the
future but is static for now.
When we need to split a node (e.g. table) we first check if there is a specific splitter available and use this splitter. If not, we use the default current behavior we have now (text-splitting).
However, the node-type splitter like ListSplitter need to split ListItems even further. In this case, we use a recursive approach where the ListSplitter will use the ListItem as markdown (or AST if we have it) and simply create a child MarkdownTreeSplitter instance to handle the splitting of sub-nodes (ListItem, TableRow, TableCell, ...).
It is important that each splitter (e.g. ListSplitter) can be used stand-alone, so we need to extract some of the core properties and functions maybe into a AbstractSplitter parent class, e.g. isWithinAllowedSize().

Anaylze the current implementation and my requirements.
Plan the new classes and interfaces and how they would be integrated into the main splitter class.
Make a detailed plan and write it down.
