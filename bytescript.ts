interface ByteScript {
    code: string;
    name?: string;
}

namespace bytescript {
    function _parseInt(a: string): any {
        return parseInt(a);
    }
    
    export function preprocess(lines: string[], buildMode = false): string[] {
        const labelMap: { [name: string]: number } = {}
        let address = 0

        // Pass 1 — collect labels and addresses
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) {
                if (!buildMode) address++ // in non-build mode, blanks count
                continue
            }

            if (line.endsWith(":")) {
                labelMap[line.slice(0, -1).trim()] = address
                continue
            }

            if (line.startsWith(";")) {
                if (!buildMode) address++ // in non-build mode, comments count
                continue
            }


            // In build mode, only actual instructions count
            address++
        }

        // Pass 2 — rewrite label refs, strip comments/blanks
        const out: string[] = []
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim()

            // Skip label definitions
            if (line.endsWith(":")) continue

            // Skip blank lines and full-line comments in build mode
            if (buildMode && (!line || line.startsWith(";"))) continue

            // Strip inline comment if present
            const semi = line.indexOf(";")
            if (semi !== -1) {
                line = line.slice(0, semi).trim()
                if (!line && buildMode) continue

            }

            const parts = line.split(" ")
            const op = parts[0]

            if (op === "GOTO" && parts.length > 1 && labelMap[parts[1]] !== undefined) {
                parts[1] = `${labelMap[parts[1]]}`
                line = parts.join(" ")
            } else if (
                (op === "GOTO_IF_ZERO" || op === "GOTO_IF_NOT_ZERO") &&
                parts.length > 2 &&
                labelMap[parts[2]] !== undefined
            ) {
                parts[2] = `${labelMap[parts[2]]}`
                line = parts.join(" ")
            }

            out.push(line)
        }

        return preprocessMP(out)
    }

    export function preprocessMP(lines: string[]): string[] {
        // Use a plain object for O(1) membership checks
        const vars: { [name: string]: true } = {}
        const out: string[] = []

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim()

            // Keep blank lines and comments as-is
            if (!line || line.startsWith(";")) {
                out.push(line)
                continue
            }

            // Tokenize once
            const parts = line.split(" ")
            const op = parts[0]

            // Track variables from VAR declarations
            if (op === "VAR" && parts.length >= 2) {
                vars[parts[1]] = true
            }

            // Rewrite MP_ADD / MP_SUB immediately
            if ((op === "MP_ADD" || op === "MP_SUB") && parts.length >= 3) {
                const isVar = !!vars[parts[2]]
                if (op === "MP_ADD") {
                    parts[0] = isVar ? "VADD" : "ADD"
                } else {
                    parts[0] = isVar ? "VSUB" : "SUB"
                }
            }

            out.push(parts.join(" "))
        }

        return out
    }
    
    function splitParts(line: string): string[] {
        return line.trim().split(" ").filter(p => p.length > 0);
    }

    function isNumberToken(tok: string): boolean {
        // Simple numeric check for pre-preprocessing stage
        for (let i = 0; i < tok.length; i++) {
            const c = tok.charCodeAt(i);
            if (c < 48 || c > 57) return false;
        }
        return tok.length > 0;
    }

    export function inlineSingleUseLabels(lines: string[]): string[] { // Arrays for labels and refs 
        const labelNames: string[] = []
        const labelPositions: number[] = []
        const refLabels: string[] = []
        // Pass 1 – collect labels
        for (let i: number = 0; i < lines.length; i++) {
            const t: string = lines[i].trim()
            if (t && t.charAt(t.length - 1) === ":") {
                labelNames.push(t.slice(0, t.length - 1))
                labelPositions.push(i)
            }
        }

        // Pass 2 – collect refs from GOTOs
        for (let i: number = 0; i < lines.length; i++) {
            const parts: string[] = lines[i].trim().split(" ")
            if (parts[0] === "GOTO" && parts.length >= 2 && isNaN(parseInt(parts[1], 10))) {
                refLabels.push(parts[1])
            }

        }

        // Pass 3 – inline labels that appear exactly once
        const output: string[] = []

        for (let i: number = 0; i < lines.length; i++) {
            const parts: string[] = lines[i].trim().split(" ")
            if (parts[0] === "GOTO" && parts.length >= 2) {
                const target: string = parts[1]

                // Count how many times target appears in refLabels
                let count: number = 0
                for (let k: number = 0; k < refLabels.length; k++) {
                    if (refLabels[k] === target) {
                        count++
                    }
                }

                if (count === 1) {
                    // Find label position
                    const labelIdx: number = labelNames.indexOf(target)
                    if (labelIdx !== -1) {
                        const start: number = labelPositions[labelIdx] + 1
                        let end: number = start
                        while (
                            end < lines.length &&
                            lines[end].trim().charAt(lines[end].trim().length - 1) !== ":"
                        ) {
                            end++
                        }
                        output.push(
                            "; Inlined from " +
                            target +
                            " By ByteScript's Optimizer in Pass 3: inline labels that appear exactly once"
                        )
                        for (let j: number = start; j < end; j++) {
                            output.push(lines[j])
                        }
                        continue // skip pushing the original GOTO
                    }
                }
            }
            // If we didn't inline, keep the original line
            output.push(lines[i])

        }

        return output
    }

    /**
 * Execute a ByteScript program directly from source form,
 * without compiling to ByteCode first. This "half‑VM" interprets
 * the original source lines in memory using a varmap for assist.
 *
 * @param c         The ByteScript source form to execute in-place.
 * @returns         Nothing. Side effects come from the program itself,
 *                  such as PRINT output or variable/state changes.
 */
    export function runCode(c: ByteScript) {
        let lines = c.code.split("\n");
        let lram = Buffer.create(256);
        let varmap: Map<string, number> = new Map()
        lines = inlineSingleUseLabels(lines);
        lines = preprocess(lines, false);
        let vars: { [index: string]: any } = { "__complied__": "false" };
        let i = 0;
        let counter = 0;
        while (i < lines.length) {
            let line = lines[i];
            let parts = line.split(" ");
            switch (parts[0]) {
                case "GOTO": i = _parseInt(parts[1]) - 1; break; // GOTO 800
                case "ADD": vars[parts[1]] += parseInt(parts[2]); break; // ADD A 4
                case "SUB": vars[parts[1]] -= parseInt(parts[2]); break; // SUB A 8
                case "VAR": vars[parts[1]] = parts[2]; if (!varmap.has(parts[1])) { varmap.set(parts[1], counter++) }; break; // VAR A 2
                case "PRINT": console.log(`PRINT:${handle(parts.slice(1).join(' '), vars)}`); break; // PRINT SOME_VAR/VALUE,  NOT SUPPORTED IN BYTECODE.
                case "HALT": return; break; // HALT
                case "GOTO_IF_ZERO": vars[parts[1]] == 0 ? i = (_parseInt(parts[2]) - 1) : 0; break; // GOTO_IF_ZERO SOME_VAR SOME_LOCATION
                case "GOTO_IF_NOT_ZERO": vars[parts[1]] !== 0 ? i = (_parseInt(parts[2]) - 1) : 0; break; // GOTO_IF_NOT_ZERO SOME_VAR SOME_LOCATION
                case "MEM_STORE": {
                    // parts[1] = numeric var address (low-level slot ID)
                    // parts[2] = value to store

                    const slotAddr = parseInt(parts[1]);
                    const value = parseInt(parts[2]);

                    // Reverse-lookup: find which key(s) map to this slotAddr
                    const keys = findKeyByValue<string, number>(varmap, slotAddr);

                    if (keys.length > 0) {
                        const varName = keys[0]; // assuming unique slot addresses
                        // Now actually perform the store in the source-VM state
                        vars[varName] = value;
                    } else {
                        console.log("Intrepter Crash: Invalid Address.")
                        break;
                    }
                    break;
                }
                case "SHR": vars[parts[1]] >>= _parseInt(parts[2]); break;
                case "SHL": vars[parts[1]] <<= _parseInt(parts[2]); break;
                case "PAUSE": pause(parseInt(parts[1]) / 50); break // assumes 50khz clock rate for emulation.
                case "VADD": vars[parts[1]] = (intify(vars[parts[1]]) + intify(vars[parts[2]])); break;
                case "VSUB": vars[parts[1]] = (intify(vars[parts[1]]) - intify(vars[parts[2]])); break;
                case "LRD": lram.setUint8(parseInt(parts[1]), parseInt(parts[2])); break;
                case "LWR": vars[findKeyByValue<string, number>(varmap, parseInt(parts[2]))[0]] = lram.getUint8(parseInt(parts[1])); break;
                case "NOP": break;
                /*
                Uneeded since the preproceser doe this.
                case "MP_ADD": if (varmap.has(parts[2])) { vars[parts[1]] = (intify(vars[parts[1]]) + intify(vars[parts[2]])) } else { vars[parts[1]] += parseInt(parts[2]); }; break; // this is auto , IE its like: choose bwteen VADD  AND ADD.
                case "MP_SUB": if (varmap.has(parts[2])) { vars[parts[1]] = (intify(vars[parts[1]]) - intify(vars[parts[2]])) } else { vars[parts[1]] -= parseInt(parts[2]); }; break; // this is auto , IE its like: choose bwteen VSUB  AND SUB.
                */
                case "GORL": i += parseInt(parts[1]); break;
                case "": break;
                default: console.log(`Intrepter Crash: Invalid Command , Cmd:${parts[0]}`); return;
            }
            i++; // INCREMENT.
        }
        vars = {};
        lram.fill(0);
    }
    function intify(a: any) {
        if (typeof a == "number") {
            return a || 0
        } else {
            return parseInt(a) || 0
        }
    }
    function handle(a: string, b: { [index: string]: any }) {
        const A_WORD = a.split(" ")[0]
        if (!!b[A_WORD]) {
            return b[A_WORD];
        } else {
            return a;
        }
    }
    function findKeyByValue<K, V>(map: Map<K, V>, searchValue: V): K[] {
        const result: K[] = [];
        const vals = map.valuesArray();
        const keys = map.keysArray();

        for (let i = 0; i < vals.length; i++) {
            if (vals[i] === searchValue) {
                result.push(keys[i]);
            }
        }
        return result;

    }
}