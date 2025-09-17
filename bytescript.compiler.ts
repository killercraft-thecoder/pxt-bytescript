/**
 * The ByteScript Language.
 */
namespace bytescript {
    export let USE_32KB_ROM = false;
    type BYTECODE_TYPE = number;
    export let BYTECODE_SUPPORTS_PAUSE = false;
    export const BYTESCRIPT_BYTECODE_SIG = 79489365;
    interface ByteCode {
        bytecode: number[];
        type: BYTECODE_TYPE;
    }
    /** For Internal Use Only. */
    export class BYTESCRIPT_COMP {
        private _nums: number[] = [];
        constructor() {
        }
        get bytecode() {
            return this._nums;
        }
        /** 
         * GOTO or long_call (does not nesacry take longer , just means it is a asobulte jump and he address it jumps to is 16-bit instead of the reg 8-bit.)
        */
        addGOTO(address: number) {
            this._nums.push(1)
            this._nums.push(address & 0xFF);
            this._nums.push((address >> 8) & 0xFF); // how to?
        }
        /** 
         * GOTO but relative
        */
        addGORL(address: number) {
            this._nums.push(14)
            this._nums.push(address & 0xFF); // lets just asume TypeScript will auto do this convsion for signed.
            this._nums.push((address >> 8) & 0xFF);
        }
        addADD(varaddress: number, v: number) {
            this._nums.push(2)
            this._nums.push(varaddress);
            this._nums.push(v)
        }
        addSUB(varaddress: number, v: number) {
            this._nums.push(3)
            this._nums.push(varaddress);
            this._nums.push(v)
        }
        addVAR(varaddress: number, v: number) {
            this._nums.push(3)
            this._nums.push(varaddress);
            this._nums.push(v & 0xFF)
            this._nums.push((v >> 8) & 0xFF);
        }
        addLRD(address: number, value: number) {
            this._nums.push(12)
            this._nums.push(address)
            this._nums.push(value)
        }
        addLWR(address: number, varaddress: number) {
            this._nums.push(13)
            this._nums.push(address)
            this._nums.push(varaddress)
        }
        addHALT() {
            this._nums.push(255)
            this._nums.push(0);
            this._nums.push(0)
        }
        addGOTO_IF_ZERO(varaddress: number, v: number) {
            this._nums.push(4);                  // opcode
            this._nums.push(varaddress);         // variable address
            this._nums.push(v & 0xFF);            // low byte
            this._nums.push((v >> 8) & 0xFF);     // high byte
        }

        addSET(varaddress: number, v: number) {
            this._nums.push(15)
            this._nums.push(varaddress)
            this._nums.push(v & 0xFF)
            this._nums.push((v >> 8) & 0xFF);
        }

        addGOTO_IF_NOT_ZERO(varaddress: number, v: number) {
            this._nums.push(5);                  // opcode
            this._nums.push(varaddress);         // variable address
            this._nums.push(v & 0xFF);            // low byte
            this._nums.push((v >> 8) & 0xFF);     // high byte
        }

        addGOTO_IF_EQ(varaddress: number, varaddress2: number, v: number) {
            this._nums.push(14);                 // opcode
            this._nums.push(varaddress);         // first variable address
            this._nums.push(varaddress2);        // second variable address
            this._nums.push(v & 0xFF);            // low byte
            this._nums.push((v >> 8) & 0xFF);     // high byte
        }
        addGOTO_IF_NE(varaddress: number, varaddress2: number, v: number) {
            this._nums.push(15);                 // opcode
            this._nums.push(varaddress);         // first variable address
            this._nums.push(varaddress2);        // second variable address
            this._nums.push(v & 0xFF);            // low byte
            this._nums.push((v >> 8) & 0xFF);     // high byte
        }
        addSHR(varaddress: number, v: number) {
            this._nums.push(6)
            this._nums.push(varaddress);
            this._nums.push(v & 0xFF)
        }
        addSHL(varaddress: number, v: number) {
            this._nums.push(7)
            this._nums.push(varaddress);
            this._nums.push(v & 0xFF)
        }
        addVADD(varA: number, varB: number) {
            this._nums.push(9)
            this._nums.push(varA);
            this._nums.push(varB)
        }
        addVSUB(varA: number, varB: number) {
            this._nums.push(10);
            this._nums.push(varA);
            this._nums.push(varB)
        }
        addPRINT(varaddress: number) {
            this._nums.push(11);
            this._nums.push(varaddress);
            this._nums.push(0)
        }
        addSig() {
            const sig = 10058;
            this._nums.insertAt(0, 0);
            this._nums.insertAt(1, sig & 0xFF);       // low byte
            this._nums.insertAt(2, (sig >> 8) & 0xFF); // high byte
        }
        addPAUSE(time: number) {
            // assumption: BYTECODE_SUPPORTS_PAUSE is defined and valid.
            if (BYTECODE_SUPPORTS_PAUSE) {
                // supported , allows wait up to 65535 cycles.
                this._nums.push(8)
                this._nums.push(time & 0xFF);
                this._nums.push((time >> 8) & 0xFF);
            } else {
                // fallback:NOP train. , only good for few cycle pauses , else... it takes up to much binary size , though this allows any wait time (though it tkaeis up lines of code.)
                for (let i = 0; i < time; i++) {
                    this._nums.push(0)
                    this._nums.push(0)
                    this._nums.push(0)
                }
            }
        }
        addNOP() {
            this._nums.push(0)
            this._nums.push(0)
            this._nums.push(0)
        }
    }
    /**
 * Compile a ByteScript source program into ByteCode.
 * This is the assembler stage of the toolchain.
 *
 * @param c         The ByteScript source form (human-readable opcodes,
 *                  labels, and variable map) to compile.
 *                  (e.g. single-use label inlining) before emitting bytecode.
 * @returns         A ByteCode object representing the fully compiled,
 *                  label-resolved instruction stream ready for execution.
 */
    export function compileCode(c: ByteScriptSource): ByteCode {
        console.log("Starting Build...")
        let lines: string[] = [];
        if (typeof c == "string") {
            lines = c.split("\n");
        } else {
            lines = c.code.split("\n");
        }
        lines = inlineSingleUseLabels(lines);
        lines = preprocess(lines, true)
        let varmap = new Map<string, number>();
        const curr = new BYTESCRIPT_COMP();
        console.log("Initalized Build...")
        let MP = 0;
        let MP_1 = 0;
        let MP_2 = 0;
        for (let line of lines) {
            let parts = (line.split(" ")) || ["NOP", "0"]
            if (parts[0] == "") continue
            switch (parts[0]) {
                case "GOTO": let addr = parseInt(parts[1]); if (addr < 0 || addr > lines.length - 1) { console.log("Build Error: Address " + addr + " To GO TO is Invalid."); break; }; curr.addGOTO(addr * 3); break; // GOTO 800
                case "ADD": curr.addADD(map(parts[1], varmap), parseInt(parts[2])); break; // ADD A 4
                case "SUB": curr.addSUB(map(parts[1], varmap), parseInt(parts[2])); break; // SUB A 8
                case "VAR": curr.addVAR(map(parts[1], varmap), parseInt(parts[2])); break; // VAR A 2
                case "PRINT": varmap.has(parts[1]) ? curr.addPRINT(map(parts[1], varmap)) : console.log("Build Warning:PRINT string not supported"); break;
                case "HALT": curr.addHALT();
                case "GOTO_IF_ZERO": curr.addGOTO_IF_ZERO(map(parts[1], varmap), parseInt(parts[2])); break; // GOTO_IF_ZERO SOME_VAR SOME_LOCATION
                case "GOTO_IF_NOT_ZERO": curr.addGOTO_IF_NOT_ZERO(map(parts[1], varmap), parseInt(parts[2])); break; // GOTO_IF_NOT_ZERO SOME_VAR SOME_LOCATION
                // case "GOTO_IF_EQ": vars[parts[0]] == vars[parts[1]] ? i = (_parseInt(parts[2]) - 1) : 0;break; // GOTO_IF_EQ SOME_VAR SOME_VAR2 SOME_LOCATION
                case "GOTO_IF_EQ": curr.addGOTO_IF_EQ(map(parts[1], varmap), map(parts[1], varmap), parseInt(parts[2])); break;
                // case "GOTO_IF_NE": vars[parts[0]] != vars[parts[1]] ? i = (_parseInt(parts[2]) - 1) : 0; break; // GOTO_IF_NE SOME_VAR SOME_VAR2 SOME_LOCATION
                case "GOTO_IF_NE": curr.addGOTO_IF_NE(map(parts[1], varmap), map(parts[1], varmap), parseInt(parts[2])); break;
                case "MEM_STORE": curr.addVAR(parseInt(parts[1]), parseInt(parts[2])); break; // LOW LEVEL.
                case "SHR": curr.addSHR(map(parts[1], varmap), parseInt(parts[2])); break;
                case "SHL": curr.addSHL(map(parts[1], varmap), parseInt(parts[2])); break;
                case "VADD": curr.addVADD(map(parts[1], varmap), map(parts[2], varmap)); break;
                case "VSUB": curr.addVSUB(map(parts[1], varmap), map(parts[2], varmap)); break;
                case "PAUSE": curr.addPAUSE(parseInt(parts[1])); break;
                case "LRD": curr.addLRD(parseInt(parts[1]), parseInt(parts[2])); break;
                case "LWR": curr.addLWR(parseInt(parts[1]), map(parts[2], varmap)); break;
                case "NOP": curr.addNOP(); break;
                case "GORL": curr.addGORL(parseInt(parts[1])); break;
                case "MP_ADD": MP++; if (varmap.has(parts[2])) { MP_1++; curr.addVADD(map(parts[1], varmap), map(parts[2], varmap)); } else { MP_2++; curr.addADD(map(parts[1], varmap), parseInt(parts[2])) }; break; // this is auto , IE its like: choose bwteen VADD  AND ADD.
                case "MP_SUB": MP++; if (varmap.has(parts[2])) { MP_1++; curr.addVSUB(map(parts[1], varmap), map(parts[2], varmap)); } else { MP_2++; curr.addSUB(map(parts[1], varmap), parseInt(parts[2])) }; break; // this is auto , IE its like: choose bwteen VSUB  AND SUB.
                case "SET": curr.addSET(map(parts[1], varmap), parseInt(parts[2])); break;
                default: console.log("Build Warning: Command " + (parts[0] || "EMPTY_STRING") + " Not Supported."); break;
            }
            if (varmap.valuesArray().length > 255) {
                return { bytecode: [], type: BYTESCRIPT_BYTECODE_SIG };
            }
        }
        const rom_used = Math.roundWithPrecision(((curr.bytecode.length / 1024) / (USE_32KB_ROM ? 32 : 4)) * 100, 4)
        if (rom_used > 100) {
            // oh noo!
            console.log(`Build Failure , Out of ROM , needs:${rom_used / 100}x more ROM.`)
            return { bytecode: [], type: BYTESCRIPT_BYTECODE_SIG }
        }
        console.log(`Build Completed, Build Info: Varibles Used ${varmap.valuesArray().length}/256, ROM used:${rom_used}% or in alternate format:${curr.bytecode.length / 3}/${USE_32KB_ROM ? "10,922" : "1,365"} Lines Used. , Asummptions for Size Caluctions: ROM is ${USE_32KB_ROM ? "32KB" : "4KB"}, ${MP > 0 ? `Out of Total Multi Purpose commands:${MP}, ${MP_1} are VADD/VSUB , and ${MP_2} are ADD/SUB` : ""}`)
        curr.addSig();
        return { bytecode: curr.bytecode, type: BYTESCRIPT_BYTECODE_SIG };
    }
    let nextVarId = 0;
    function map(varName: string, map: Map<string, number>) {
        if (!map.has(varName)) {
            if (nextVarId > 255) {
                console.log("Build Crash: Out of Variables.");
                return null;
            }
            map.set(varName, nextVarId++);
        }
        return map.get(varName);
    }
}