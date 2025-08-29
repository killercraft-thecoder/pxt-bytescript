interface ByteScript {
    code:string;
    name?:string;
}

namespace bytescript {
    function _parseInt(a:string):any {
        return parseInt(a);
    }
    export function preprocess(lines:string[], buildMode = false) {
        const labelMap = new Map<string,any>();
        let address = 0;

        // pass 1 — find labels and record their addresses
        lines.forEach((lineRaw) => {
            const line = lineRaw.trim();

            // skip label defs in both modes, but record address mapping
            if (line.endsWith(":")) {
                const label = line.slice(0, -1).trim();
                labelMap.set(label, address);
                return;
            }

            if (buildMode) {
                // in build mode, comments/blanks don't increment address
                if (!line || line.startsWith(";")) return;
            }

            // everything else increments address counter
            address++;
        });

        // pass 2 — rewrite label references, strip fluff for build
        const out:string[] = [];
        lines.forEach(lineRaw => {
            let line = lineRaw.trim();
            if (line == "" && buildMode) return;                   // skip blanks in build mode
            if (line.startsWith(";")) {           // skip comments in build mode
                if (buildMode) return;
            }
            if (line.endsWith(":")) return;       // skip label defs always

            const parts = line.split(" ");        // plain split, not regex
            const op = parts[0];

            if (op === "GOTO" && labelMap.has(parts[1])) {
                parts[1] = labelMap.get(parts[1]);
                line = parts.join(" ");
            } else if ((op === "GOTO_IF_ZERO" || op === "GOTO_IF_NOT_ZERO") &&
                labelMap.has(parts[2])) {
                parts[2] = labelMap.get(parts[2]);
                line = parts.join(" ");
            }

            out.push(line);
        });

        return out;
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

    export function inlineSingleUseLabels(lines: string[]): string[] {
        // Arrays for labels and refs
        let labelNames: string[] = [];
        let labelPositions: number[] = [];
        let refLabels: string[] = [];

        // Pass 1 – collect labels
        for (let i = 0; i < lines.length; i++) {
            let t = lines[i].trim();
            if (t && t.charAt(t.length - 1) === ":") {
                labelNames.push(t.slice(0, t.length - 1));
                labelPositions.push(i);
            }
        }

        // Pass 2 – collect refs from GOTOs
        for (let i = 0; i < lines.length; i++) {
            let parts = lines[i].trim().split(" ");
            if (parts[0] === "GOTO" && parts.length >= 2 && isNaN(parseInt(parts[1]))) {
                refLabels.push(parts[1]);
            }
        }

        // Pass 3 – inline labels that appear exactly once
        let output: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            let parts = lines[i].trim().split(" ");
            if (parts[0] === "GOTO" && parts.length >= 2) {
                let target = parts[1];

                // Count how many times target appears in refLabels
                let count = 0;
                let firstIndex = -1;
                for (let k = 0; k < refLabels.length; k++) {
                    if (refLabels[k] === target) {
                        count++;
                        if (firstIndex === -1) firstIndex = k;
                    }
                }

                if (count === 1) {
                    // Find label position
                    let labelIdx = labelNames.indexOf(target);
                   
                    if (labelIdx !== -1) {
                        let start = labelPositions[labelIdx] + 1;
                        let end = start;
                        while (end < lines.length &&
                            lines[end].trim().charAt(lines[end].trim().length - 1) !== ":") {
                            end++;
                        }
                        output.push("; Inlined from " + target);
                        for (let j = start; j < end; j++) {
                            output.push(lines[j]);
                        }
                        continue; // skip pushing the GOTO
                    }
                }
            }
            output.push(lines[i]);
        }
        return output;
    }
    /**
 * Execute a ByteScript program directly from source form,
 * without compiling to ByteCode first. This "half‑VM" interprets
 * the original source lines in memory using a varmap for assist.
 *
 * @param c         The ByteScript source form to execute in-place.
 * @param optimize  Optional flag. If true, applies optimizer passes
 *                  before interpreting the program.
 * @returns         Nothing. Side effects come from the program itself,
 *                  such as PRINT output or variable/state changes.
 */
    export function runCode(c:ByteScript,optmize?:boolean) {
        let lines = c.code.split("\n");
        let lram = Buffer.create(256);
        let varmap:Map<string,number> = new Map()
        if (optmize && optmize == true) {
            lines = inlineSingleUseLabels(lines);
        }
        lines = preprocess(lines,false);
        let vars:{[index:string]:any} = {"__complied__":"false"};
        let i = 0;
        let counter = 0;
        while (i < lines.length) {
            let line = lines[i].trim().split(";")[0] || "NOP";
            let parts = line.split(" ");
            switch (parts[0]) {
                case "GOTO": i = _parseInt(parts[1]) - 1; break; // GOTO 800
                case "ADD": vars[parts[1]] += parseInt(parts[2]); break; // ADD A 4
                case "SUB": vars[parts[1]] -= parseInt(parts[2]); break; // SUB A 8
                case "VAR": vars[parts[1]] = parts[2];if (!varmap.has(parts[1])) {varmap.set(parts[1],counter++)}; break; // VAR A 2
                case "PRINT":console.log(`PRINT:${handle(parts.slice(1).join(' '),vars)}`); break; // PRINT SOME_VAR/VALUE,  NOT SUPPORTED IN BYTECODE.
                case "HALT": return; break; // HALT
                case "GOTO_IF_ZERO": vars[parts[1]] == 0 ? i = (_parseInt(parts[2]) - 1) : 0; break; // GOTO_IF_ZERO SOME_VAR SOME_LOCATION
                case "GOTO_IF_NOT_ZERO": vars[parts[1]] !== 0 ? i = (_parseInt(parts[2]) - 1) : 0; break; // GOTO_IF_NOT_ZERO SOME_VAR SOME_LOCATION
                case "MEM_STORE": {
                    // parts[1] = numeric var address (low-level slot ID)
                    // parts[2] = value to store

                    const slotAddr = parseInt(parts[1]);
                    const value = parseInt(parts[2]);

                    // Reverse-lookup: find which key(s) map to this slotAddr
                    const keys = findKeyByValue<string,number>(varmap, slotAddr);

                    if (keys.length > 0) {
                        const varName = keys[0]; // assuming unique slot addresses
                        // Now actually perform the store in your source-VM state
                        vars[varName] = value;
                    } else {
                        console.log("Intrepter Crash: Invalid Address.")
                        break;
                    }
                    break;
                }
                case "SHR": vars[parts[1]] >>= _parseInt(parts[2]); break;
                case "SHL": vars[parts[1]] <<= _parseInt(parts[2]); break;
                case "PAUSE": pause(parseInt(parts[1]) / 50);break // assumes 50khz clock rate for emulation.
                case "VADD": vars[parts[1]] = (intify(vars[parts[1]]) + intify(vars[parts[2]])); break;
                case "VSUB": vars[parts[1]] = (intify(vars[parts[1]]) - intify(vars[parts[2]])); break;
                case "LRD": lram.setUint8(parseInt(parts[1]),parseInt(parts[2]));break;
                case "LWR": vars[findKeyByValue<string,number>(varmap,parseInt(parts[2]))[0]] = lram.getUint8(parseInt(parts[1]));break;
                case "NOP":break;
                default: console.log("Intrepter Crash: Invalid Command");return;
            }
            i++; // INCREMENT.
        }
        vars = {};
        lram.fill(0);
    }
    function intify(a:any) {
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