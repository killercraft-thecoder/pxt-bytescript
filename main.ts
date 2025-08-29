//bytescript.runCode({ code: "PRINT A IS B RIGHT? \n PRINT CRAZY. \n PRINT PREP FOR REPITION. \n GOTO 0" })
let DIGIT = 1
const prog = `
; Fast Fibonacci with VADD / VSUB and labels

VAR A 0        ; first term
VAR B 1        ; second term
VAR N ${DIGIT}       ; loop count = n - 1 (so Fib(32) at end)
VAR TMP 0      ; temporary

; ---- Loop start ----
LOOP_START:
    GOTO STAGE1
STAGE1:
    VAR TMP 0      ; TMP = 0
    VADD TMP A     ; TMP = A
    VADD TMP B     ; TMP = A + B
    GOTO STAGE2
STAGE2:
    VAR A 0        ; A = 0
    VADD A B       ; A = old B

    VAR B 0        ; B = 0
    VADD B TMP     ; B = sum
    GOTO FINISH
FINISH:
    SUB N 1        ; N = N - 1
    GOTO_IF_NOT_ZERO N LOOP_START

    PRINT B
    HALT           ; stop execution early, even though end of code would stop anyway
`
function log(a:any) {
    console.log(a);
    game.showLongText(a,DialogLayout.Full);
}
//let bytecode = bytescript.compileCode({ code: prog })
//console.log(bytecode.bytecode)
log("Starting Execute...")
let start = control.micros();
bytescript.runCode({ code: prog })
let end = control.micros();
let time = (end - start) / 1000;
log(`TIME TAKEN:${time} milliseconds to calcuate the ${DIGIT}th fibanchi number`)
log(`Optmized Source:${bytescript.inlineSingleUseLabels(prog.split("\n")).join("\n")}`)