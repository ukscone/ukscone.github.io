let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;

var inRawRepl = false;
var controlChar = false;
var pasteMode = false;
var loading = false;

const connectButton = document.getElementById('connectButton');
const disconnectButton = document.getElementById('disconnectButton')

const softRebootButton = document.getElementById('softReboot')
const breakButton = document.getElementById('break')
const leavePasteModeButton = document.getElementById('leavePasteMode')
const enterPasteModeButton = document.getElementById('enterPasteMode')
//const enterRawREPLButton = document.getElementById('enterRawREPL')
//const leaveRawREPLButton = document.getElementById('leaveRawREPL')

const runButton = document.getElementById('run')
const sendButton = document.getElementById('send')
const clearButton = document.getElementById('clear')
const fileNamePrompt = document.getElementById('getFileFromPico')
const fileSelect = document.getElementById("getFile"),
    fileElem = document.getElementById("fileElem");

fileSelect.addEventListener("click", function (e) {
    if (fileElem) {
        fileElem.click();
    }
}, false);

fileElem.addEventListener("change", handleFiles, false);
function handleFiles() {
    const fileList = this.files[0]; /* now you can work with the file list */
    console.log(fileList);
    var reader = new FileReader();
    reader.readAsText(fileList);
    reader.onload = function () { editor.setValue(reader.result); }
}

function fnPrompt() {
    var txt;
    var fName = prompt("Please enter filename on pico:", "");
    if (fName == null || fName == "") {
        txt = "User cancelled the prompt.";
    } else {
        txt = "filename:- " + fName;
    }
    loading = true;
    writeToStream("f=open(\"" + fName + "\");z=f.read();f.close();print(z);");
    console.log(txt);
}

fileNamePrompt.addEventListener("click", e => {
    fnPrompt();
});
connectButton.addEventListener('click', e => {
    clickConnect();
});

disconnectButton.addEventListener('click', e => {
    disconnect();
})

softRebootButton.addEventListener('click', e => {
    controlChar = true;
    writeToStream('\04');
})

breakButton.addEventListener('click', e => {
    controlChar = true;
    writeToStream('\03\03');
})

leavePasteModeButton.addEventListener('click', e => {
    writeToStream('\04');
})

enterPasteModeButton.addEventListener('click', e => {
    writeToStream('\05')
})

runButton.addEventListener('click', e => {
    it = editor.getValue()

    console.log(it);
    ait = it.split('\n');
    console.log(ait);
    writeToStream('\05')
    for (i = 0; i < ait.length; i++) {
        writeToStream(ait[i]);
    }
    writeToStream('\04');
})


sendButton.addEventListener('click', e => {
    it = editor.getValue()

    //var inputText = document.getElementById('multiLineInput')
    //it = inputText.value
    console.log(it);
    ait = it.split('\n');
    console.log(ait);
    for (i = 0; i < ait.length; i++) {
        writeToStream(ait[i]);
    }

})

clearButton.addEventListener('click', e => {
    editor.getDoc().setValue('');
})


/*
enterRawREPLButton.addEventListener('click', e => {

    console.log("entering Raw REPL");
    writeToStream('\01\05A\x01');
    inRawRepl = true;
})

leaveRawREPLButton.addEventListener('click', e => {
    inRawRepl = false;
    console.log("leaving Raw REPL");
    writeToStream('\04\02')

})
*/


//Connect to the Serial Port
const connect = async () => {

    var baudrate = document.getElementById('baudrate').value;
    var databits = document.getElementById('databits').value;
    var stopbits = document.getElementById('stopbits').value;
    var parity = document.getElementById('parity').value;

    console.log('baudrate: ' + baudrate + ' databits: ' + databits + ' parity: ' + parity + ' stopbits: ' + stopbits)
    port = await navigator.serial.requestPort();
    await port.open({
        baudRate: baudrate,
        dataBits: databits,
        parity: parity,
        stopBits: stopbits
    }) // Permission issues caused by this


    //Creating an Input Stream 
    let decoder = new TextDecoderStream();
    inputDone = port.readable.pipeTo(decoder.writable);
    inputStream = decoder.readable;

    reader = inputStream.getReader();


    const encoder = new TextEncoderStream();
    outputDone = encoder.readable.pipeTo(port.writable);
    outputStream = encoder.writable;

    document.getElementById("connectButton").disabled = true;
    document.getElementById('databits').disabled = true;
    document.getElementById('baudrate').disabled = true;
    document.getElementById('stopbits').disabled = true;
    document.getElementById('parity').disabled = true;
    document.getElementById("disconnectButton").disabled = false;

    writeToStream('\04');
    await readOne();
}

//disconnect from the serial port
const disconnect = async () => {
    if (reader) {
        await reader.cancel();
        await inputDone.catch(() => { });
        reader = null;
        inputDone = null;
    }

    if (outputStream) {
        await outputStream.getWriter().close();
        await outputDone;
        outputStream = null;
        outputDone = null;
    }

    await port.close();
    port = null;
    document.getElementById("connectButton").disabled = false;
    document.getElementById('databits').disabled = false;
    document.getElementById('parity').disabled = false;
    document.getElementById('stopbits').disabled = false;
    document.getElementById('baudrate').disabled = false;
    document.getElementById("disconnectButton").disabled = true;
}

const clickConnect = async () => {
    await connect()
}

const readLoop = async () => {


    while (true) {
        const {
            value,
            done
        } = await reader.read();
        if (value) {
            console.log(value);

        }
        if (done) {
            console.log('[readLoop] DONE', done);
            reader.releaseLock();
            console.log('disconnected')
            break;
        }
    }
}

function insertString(editor, str) {

    var selection = editor.getSelection();

    if (selection.length > 0) {
        editor.replaceSelection(str);
    }
    else {

        var doc = editor.getDoc();
        var cursor = doc.getCursor();

        var pos = {
            line: cursor.line,
            ch: cursor.ch
        }

        doc.replaceRange(str, pos);

    }

}

var curString = "";
const readOne = async () => {

    for (let i = 0; i < 20; i++) {
        const {
            value,
            done
        } = await reader.read();
        if (value) {
            console.log(value);
            if (loading == false) {
                console.log("normal");
                document.getElementById('multiLineOutput').textContent += value;
                document.getElementById("multiLineOutput").scrollTop = document.getElementById("multiLineOutput").scrollHeight
            } else {
                if (value.includes(">>>")) {
                    console.log("prompt");

                    val1 = value.replace(">>>", '');
                    curString += val1;
                    const lines = curString.split('\n');
                    lines.shift();
                    const cleancode = lines.join('\n');
                    insertString(editor, cleancode);
                    loading = false;
                } else {

                    //val1 = value.replace(">>>",'');
                    //curText = editor.getValue();
                    //val2 = val1.replaceAll("\\n", '\n');
                    //editor.replaceRange(val2, CodeMirror.Pos(editor.lastLine()));
                    //insertString(editor,value);
                    curString += value;
                    console.log("value " + value);
                }
            }
        }
    }
}

/*
function findTextInBuffer(textList,textToFind) {
    let wordArrayPosition = 0;
    textList.some((el, idx) => {
        let innerIndex = el.indexOf(textToFind);
        if (innerIndex !== -1) {
            wordArrayPosition = idx;
            return;
        }


    })
    return wordArrayPosition
}
*/


const writeToStream = (...lines) => {
    const writer = outputStream.getWriter();
    lines.forEach((line) => {
        console.log('[SEND]', line);
        if (inRawRepl == true) {
            console.log("sending raw repl string");
            writer.write(line + '\04');
        } else if (controlChar == true) {
            console.log("sending control character");
            controlChar = false;
            writer.write(line);
        } else {
            console.log("sending normal char");
            writer.write(line + '\r');
        }
    });
    writer.releaseLock();
}