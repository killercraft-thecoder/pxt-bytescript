## ByteScript

**ByteScript** is a compact, fantasy‑hardware–style language designed to run in two distinct modes:

1. **Source interpretation** – Executes the original human‑readable source directly in the *source interpreter* ("half‑VM"), retaining variable names and labels for debugging and emulation.
2. **Bytecode execution** – Compiles the same source into a compact, numeric‐only instruction stream for the *compiled VM*, which runs faster and uses less memory.

### PRINT in Bytecode
The compiled bytecode VM supports the `PRINT` instruction **only** when printing a **numeric value** — typically the value stored in a variable.  
Printing arbitrary strings is **not** supported in bytecode mode, as this would require additional complexity such as:
- Embedding string data directly in the byte stream (e.g., via NOP‑encoded segments or data blocks).
- Managing address mapping and retrieval of those embedded strings at runtime.

These features are intentionally omitted to keep the bytecode VM minimal and efficient.

### Variable Handling in Bytecode
In compiled form:
- **Each variable** is assigned a **single‑byte address** (0–255).
- The bytecode references **only these numeric addresses** — original variable names are not preserved.
- This imposes a hard limit of **256 variables per program** but greatly reduces binary size and speeds up execution.
- In source form, a `varmap` associates names to addresses, but this mapping is discarded when compiling to bytecode.

## Note:
the Most Recent version sshow around 3.23x faster perfomance than the old speed before optimaztions of around 113.95ms which includes optmizing and running time.

---

> Open this page at [https://killercraft-thecoder.github.io/pxt-bytescript/](https://killercraft-thecoder.github.io/pxt-bytescript/)

## Use as Extension

This repository can be added as an **extension** in MakeCode.

* open [https://arcade.makecode.com/](https://arcade.makecode.com/)
* click on **New Project**
* click on **Extensions** under the gearwheel menu
* search for **https://github.com/killercraft-thecoder/pxt-bytescript** and import

## Edit this project

To edit this repository in MakeCode.

* open [https://arcade.makecode.com/](https://arcade.makecode.com/)
* click on **Import** then click on **Import URL**
* paste **https://github.com/killercraft-thecoder/pxt-bytescript** and click import

#### Metadata (used for search, rendering)

* for PXT/arcade
<script src="https://makecode.com/gh-pages-embed.js"></script><script>makeCodeRender("{{ site.makecode.home_url }}", "{{ site.github.owner_name }}/{{ site.github.repository_name }}");</script>
