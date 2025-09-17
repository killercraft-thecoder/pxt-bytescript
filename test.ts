// tests go here; this will not be compiled when this package is used as an extension.
//bytescript.runCode({ code: "PRINT A IS B RIGHT? \n PRINT CRAZY. \n PRINT PREP FOR REPITION. \n GOTO 0" })
let DIGIT = 300
let prog = `
; Fast Fibonacci with VADD / VSUB and labels

VAR A 0        ; first term
VAR B 1        ; second term
VAR N ${DIGIT}       ; loop count = n - 1 (so Fib(32) at end)
VAR TMP 0      ; temporary

; ---- Loop start ----
; THIS IS NOT INLINED AWAY BECUASE IT HAS OVER 1 CALL.
LOOP_START:
    GOTO STAGE1 ; JUMP to STAGE 1 , INLINED TO NO CALL AT ALL.
STAGE1:
    VAR TMP 0      ; TMP = 0
    MP_ADD TMP A     ; TMP = A
    MP_ADD TMP B     ; TMP = A + B
    GOTO STAGE2    ; JUMP TO STAGE2
STAGE2:
    ; CLEAR A and MAKE A BE OLD B , VADD is for adding varibles.
    VAR A 0        ; A = 0
    MP_ADD A B       ; A = old B

    VAR B 0        ; B = 0
    MP_ADD B TMP     ; B = sum
    GOTO FINISH    ; JUMP TO FINISH, THIS IS ALSO OPTMIZED AWAY
FINISH:
    SUB N 1        ; N = N - 1
    GOTO_IF_NOT_ZERO N LOOP_START ; if n !== 0 , go to Loop Start.

    PRINT B        ; print Fibonacci number
    GOTO END
END:   
    HALT
`

function log(a: any) {
    console.log(a);
    game.showLongText(a, DialogLayout.Full);
}
//bytescript.USE_32KB_ROM = true;
let bytecode = bytescript.compileCode({ code: prog })
console.log(JSON.stringify(bytecode.bytecode))
///*
//log("Starting Execute...")
let start = control.micros();
bytescript.runCode({ code: prog })
let end = control.micros();
let time = (end - start) / 1000;

log(`TIME TAKEN:${time} milliseconds to calcuate the ${DIGIT}th fibanchi number`)
//game.reset()


log(`Optmized Source:${bytescript.preprocess(bytescript.inlineSingleUseLabels(prog.split("\n"))).join("\n")}`)

//*/