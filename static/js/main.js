var socket = io();

// Global variables
var puzzleSize = 0;
var direction = 0; // left to rigth, 1 for top-down

// SOCKET IO STUFF
// Connect
socket.on('connect', function () {
    socket.emit('connection');
});

// Disconnect
socket.on('disconnect', function () {
    socket.emit('disconnection')
});

// num. users
socket.on('get-online-people', function (data) {
    $("#online-users").text(data["online-users"])
});

// Tell server to store to disk
var serverStore = function () {
    socket.emit('server-store');
}

// Tell server to load from disk
var serverLoad = function () {
    socket.emit('server-load');
}

// Get ID based on row and column
var getID = function (i, j) {
    return i + "-" + j;
}

// Enable / Disable all buttons based on their actions.
var doButtonActives = function () {
    let i = 0;
    let j = 0;
    $("#buchstabenCom").attr("disabled", true);
    $(".puzzle-field.selected").each(function (index) {
        i = parseInt($(this).attr("src-row"));
        j = parseInt($(this).attr("src-col"));

        if ($("#" + getID(i, j)).hasClass("black")) {
            $("#buchstabenCom").attr("disabled", true);
        } else {
            $("#buchstabenCom").attr("disabled", false);
        }
    });

    let selector = "#" + getID(i, j);
    if ($(selector).hasClass("black")) {
        $("#blackbutton").attr("disabled", false);
        $("#blackbutton").attr("onclick", "removeBlack()").text("Remove Black");
    } else {
        $("#blackbutton").attr("onclick", "fillBlack()").text("Fill Black");
        $("#blackbutton").attr("disabled", false);
    }

    if ($(selector).attr("src-number") == "number-0") {
        $("#removenumber").attr("disabled", true);
    } else {
        $("#removenumber").attr("disabled", false);
    }

    if ($(selector).hasClass("solution-circle")) {
        $("#circlebutton").attr("onclick", "removeSolutionCircle()").text("Remove Circle");
        $("#circlebutton").attr("disabled", false);
    } else {
        $("#circlebutton").attr("onclick", "addSolutionCircle()").text("Add Circle");
        if ($(selector).hasClass("black")) {
            $("#circlebutton").attr("disabled", true);
        } else {
            $("#circlebutton").attr("disabled", false);
        }
    }
}

// Unselect all, but give focus to element given.
var deleteAllFocusAddThis = function (e) {
    $(".puzzle-field.selected").each(function (index) { $(this).removeClass("selected"); });
    $(e).addClass("selected");
    doHighlighting();

    doButtonActives();
}

var getDivString = function (i, j) {
    return "<div class='puzzle-field col justify-content-md-center' id='" +
        getID(i, j) + "'\
        contenteditable='true' src-row='" + i + "' src-col='" + j + "' src-circle='0' tabindex='" + (i * puzzleSize + j) + "' src-number='number-0' onfocusin='deleteAllFocusAddThis(this)'><span class='char'> </span></div>";
}

// set focus on the selected elements
var focusSelected = function () {
    $(".puzzle-field.selected").each(function (index) {
        $(this).focus();
    });
}

// handle on key press functionality.
var keyPressFunc = function (event) {
    var keyCode = event.keyCode || event.which;
    if (keyCode >= 96 && keyCode <= 105) {
        // Numpad keys
        keyCode -= 48;
    }

    if((keyCode < 65 || keyCode > 122) && 
            !(keyCode == 32 /* space */ || 
            keyCode == 8 /* backspace */ ||
            keyCode == 46 /* delete */ ||
            (keyCode > 36 && keyCode < 41) /* arrows */ ||
            (keyCode > 47 && keyCode < 58) /* digits */
        )) {
        event.preventDefault();
        return;
    }

    let i = parseInt($(event.currentTarget).attr("src-row"));
    let j = parseInt($(event.currentTarget).attr("src-col"));
    if(keyCode == 8 || keyCode == 46) {
        // delete current, move one back
        $(event.currentTarget).children(".char").text(" ");

        event.preventDefault();
        // move minus one in direction and call focus.

        sendBoard();
        if (direction == 0) {
            // horizontal, keep i
            if (j == 1 || $("#" + getID(i, (j - 1))).hasClass("black")) {
                return;
            } else {
                $("#" + getID(i, (j - 1))).focus();
            }
        } else {
            if (i == 1 || $("#" + getID((i - 1), j)).hasClass("black")) {
                return;
            } else {
                $("#" + getID((i - 1), j)).focus();
            }
        }
        return;
    }

    let key = String.fromCharCode(keyCode);
    if (key.match(/[0-9]/)) {
        // add small number to cell
        var attr = $("#" + getID(i, j)).attr("src-number");
        if (attr != "number-0") {
            var length = attr.length;
            if (length > 0) {
                let number = attr.split("-")[1];
                number += key;
                $(event.currentTarget).removeClass(attr);
                $(event.currentTarget).addClass("number-" + number);
                $(event.currentTarget).attr("src-number", "number-" + number);
            }
        } else {
            let number = key;
            $(event.currentTarget).removeClass("number-0");
            $(event.currentTarget).addClass("number-" + number);
            $(event.currentTarget).attr("src-number", "number-" + number);
        }

        sendBoard();
        doButtonActives();

        event.preventDefault();
        return;
    }
    if (key.match(/[A-Z\s]/)) {
        $(event.currentTarget).children(".char").text(key.toUpperCase());

        event.preventDefault();
        // move one in direction and call focus.

        sendBoard();
        if (direction == 0) {
            // horizontal, keep i
            if (j == puzzleSize || $("#" + getID(i, (j + 1))).hasClass("black")) {
                return;
            } else {
                $("#" + getID(i, (j + 1))).focus();
            }
        } else {
            if (i == puzzleSize || $("#" + getID((i + 1), j)).hasClass("black")) {
                return;
            } else {
                $("#" + getID((i + 1), j)).focus();
            }
        }
    } else {
        event.preventDefault();
        // check event key for arrow key and move focus
        switch (event.keyCode) {
            case 37:
                if (j == 1) {
                    return;
                } else {
                    $("#" + getID(i, (j - 1))).focus();
                }
                break;
            case 38:
                if (i == 1) {
                    return;
                } else {
                    $("#" + getID((i - 1), j)).focus();
                }
                break;
            case 39:
                if (j == puzzleSize) {
                    return;
                } else {
                    $("#" + getID(i, (j + 1))).focus();
                }
                break;
            case 40:
                if (i == puzzleSize) {
                    return;
                } else {
                    $("#" + getID((i + 1), j)).focus();
                }
                break;
        }
    }
}

var recomputeNumbers = function () {
    let currNumber = 1;
    for (let i = 1; i < puzzleSize + 1; i++) {
        for (let j = 1; j < puzzleSize + 1; j++) {
            if ($("#" + i + "-" + j).attr("src-number") != "number-0") {
                $("#" + i + "-" + j).removeClass($("#" + i + "-" + j).attr("src-number"));

                $("#" + i + "-" + j).attr("src-number", "number-" + currNumber);
                $("#" + i + "-" + j).addClass("number-" + currNumber);
                currNumber++;
            }
        }
    }
}

// Create a string with custom JS, which registers key presses and mouse clicks
var getClickString = function (i, j) {
    return "$('#" + getID(i, j) + "').mousedown(function(){clickFunction('" + getID(i, j) +
        "');});$('#" + getID(i, j) + "').on('keydown',keyPressFunc);";
}

// Handle mouse click
var clickFunction = function (id) {
    // if click on selected, flip direction
    if ($("#" + id).hasClass("selected")) {
        direction = (1 - direction);
        doHighlighting();
    }
}

// Fill a cell black
var fillBlack = function () {
    // search all selected pieces
    $(".puzzle-field.selected").each(function (index) {
        $(this).children(".char").text("#");
        $(this).addClass("black");
        sendBoard();
    });
    doHighlighting();
    doButtonActives();
    focusSelected();
}

// Remove black from a cell
var removeBlack = function () {
    $(".puzzle-field.selected").each(function (index) {
        $(this).children(".char").text(" ");
        $(this).removeClass("black");
        sendBoard();
    });
    doHighlighting();
    doButtonActives();
    focusSelected();
}

// handle server sending puzzle size
socket.on('puzzlesize', function (data) {
    puzzleSize = parseInt(data["size"]);

    let content = "";
    let onclickJS = "";
    for (let i = 1; i < puzzleSize + 1; i++) {
        content += "<div class='row'>";
        for (let j = 1; j < puzzleSize + 1; j++) {
            // build new board
            content += getDivString(i, j);
            onclickJS += getClickString(i, j);
        }
        content += "</div>";
    }

    $("#board").html(content); // clear old board
    $("#key-checker").html(onclickJS);
    createNumberCSS();
});

// OTHER STUFF
var getNumUsers = function () {
    socket.emit('get-online-people');
}

// send server command to send the board
var getBoard = function () {
    socket.emit('board');
}

// create a string based on the board
var createBoardString = function () {
    let result = "";
    for (let i = 1; i < puzzleSize + 1; i++) {
        for (let j = 1; j < puzzleSize + 1; j++) {
            result += $("#" + i + "-" + j).children(".char").text();
        }
    }
    return result;
}

// create number string based on the board
var createNumberString = function () {
    let result = [];
    for (let i = 1; i < puzzleSize + 1; i++) {
        for (let j = 1; j < puzzleSize + 1; j++) {
            result.push(parseInt($("#" + i + "-" + j).attr("src-number").split("-")[1]));
        }
    }
    return result;
}

// create circle string based on the board
var createCircleString = function () {
    let result = [];
    for (let i = 1; i < puzzleSize + 1; i++) {
        for (let j = 1; j < puzzleSize + 1; j++) {
            result.push(parseInt($("#" + i + "-" + j).attr("src-circle")));
        }
    }
    return result;
}

// parse the string given and set classes respectively
var parseBoardString = function (boardString) {
    let index = 0;
    for (let i = 1; i < puzzleSize + 1; i++) {
        for (let j = 1; j < puzzleSize + 1; j++) {
            $("#" + i + "-" + j).children(".char").text(boardString[index]);
            if (boardString[index] === "#") {
                $("#" + i + "-" + j).addClass("black");
            }
            index++;
        }
    }
}

// parse all numbers and add them to this board
var parseNumbers = function (numbers) {
    let index = 0;
    for (let i = 1; i < puzzleSize + 1; i++) {
        for (let j = 1; j < puzzleSize + 1; j++) {
            if ($("#" + i + "-" + j).attr("src-number") !== "number-0") {
                $("#" + i + "-" + j).removeClass($("#" + i + "-" + j).attr("src-number"));
            }
            if ($("#" + i + "-" + j).hasClass("number-0")) {
                $("#" + i + "-" + j).removeClass("number-0");
            }
            $("#" + i + "-" + j).addClass("number-" + numbers[index]);
            $("#" + i + "-" + j).attr("src-number", "number-" + numbers[index]);
            index++;
        }
    }
}

// remove numbers from a cell
var removeNumber = function () {
    $(".puzzle-field.selected").each(function (index) {
        if ($(this).attr("src-number")) {
            $(this).removeClass($(this).attr("src-number"));
            $(this).attr("src-number", "number-0");
            sendBoard();
            focusSelected();
        } else {
            focusSelected();
        }
    });
}

// send board to the server (after update)
var sendBoard = function () {
    socket.emit('update-board', { 'board': createBoardString(), "numbers": createNumberString(), "circles": createCircleString() });
};

// create custom css for each number element
var createNumberCSS = function () {
    for (let i = 0; i < puzzleSize; i++) {
        let css = "<style type='text/css'>";
        for (let j = 1; j < puzzleSize + 1; j++) {
            css += "div.puzzle-field.number-" + (i * puzzleSize + j) + "::after {\
            content: '"+ (i * puzzleSize + j) + "';\
            font-size: 50%;\
        }\
        div.hide-char.number-"+ (i * puzzleSize + j) + "::after {\
            color: black;\
            position: relative;\
            vertical-align: middle;\
            text-align: center;\
        }";
        }
        css += "</style>";
        $(css).appendTo("head");
    }
}

// parse circles from a given string
var parseCircles = function (circles) {
    let index = 0;
    for (let i = 1; i < puzzleSize + 1; i++) {
        for (let j = 1; j < puzzleSize + 1; j++) {
            if (circles[index]) {
                $("#" + i + "-" + j).addClass("solution-circle");
                $("#" + i + "-" + j).attr("src-circle", circles[index]);
            } else {
                $("#" + i + "-" + j).removeClass("solution-circle");
                $("#" + i + "-" + j).attr("src-circle", circles[index]);
            }
            index++;
        }
    }
}

// highlight cells based on their row/column (if one selected in this row/column)
var doHighlighting = function () {
    let i = 0;
    let j = 0;
    $(".puzzle-field.highlight").each(function (index) {
        $(this).removeClass("highlight");
    });

    $(".puzzle-field.selected").each(function (index) {
        i = parseInt($(this).attr("src-row"));
        j = parseInt($(this).attr("src-col"));
    });

    $(".puzzle-field.black").each(function (index) {
        if ($(this).children("span").text() != "#") {
            $(this).removeClass("black");
        }
    });

    // now move in both directions until black or wall
    if (direction === 0) {
        // change j
        let step_j = j;
        while (true) {
            if (step_j < 1) break; // wall
            if ($("#" + getID(i, step_j)).children("span").text() == "#") {
                // black
                break;
            }

            $("#" + getID(i, step_j)).addClass("highlight");
            step_j--;
        }
        step_j = j;
        while (true) {
            if (step_j == puzzleSize + 1) break; // wall
            if ($("#" + getID(i, step_j)).children("span").text() == "#") {
                // black
                break;
            }

            $("#" + getID(i, step_j)).addClass("highlight");
            step_j++;
        }
    } else {
        // change i
        let step_i = i;
        while (true) {
            if (step_i < 1) break; // wall
            if ($("#" + getID(step_i, j)).children("span").text() == "#") {
                // black
                break;
            }

            $("#" + getID(step_i, j)).addClass("highlight");
            step_i--;
        }
        step_i = i;
        while (true) {
            if (step_i == puzzleSize + 1) break; // wall
            if ($("#" + getID(step_i, j)).children("span").text() == "#") {
                // black
                break;
            }

            $("#" + getID(step_i, j)).addClass("highlight");
            step_i++;
        }
    }
}

// add a circle to the board
var addSolutionCircle = function () {
    $(".puzzle-field.selected").each(function (index) {
        if ($(this).hasClass("black")) return;
        $(this).addClass("solution-circle");
        $(this).attr("src-circle", 1);
    });
    sendBoard();
    doButtonActives();
    focusSelected();
}

// remove a circle from the board
var removeSolutionCircle = function () {
    $(".puzzle-field.selected").each(function (index) {
        $(this).removeClass("solution-circle");
        $(this).attr("src-circle", 0);
    });
    sendBoard();
    doButtonActives();
    focusSelected();
}

// open print dialog on new page
var printDialog = function (showChars) {
    // Remove all highlighting
    $(".puzzle-field.highlight").each(function (index) {
        $(this).removeClass("highlight");
    });
    // remove selected
    $(".puzzle-field.selected").each(function (index) {
        $(this).removeClass("selected");
    });

    if (!showChars) {
        $("div.puzzle-field").each(function (index) { $(this).addClass("hide-char") });
    }

    var w = window.open();

    var head = $("#headers").prop("outerHTML");
    var field = $("#print").html();

    var html = "<!DOCTYPE HTML>";
    html += '<html lang="en-us">';
    html += head;
    html += "<body>";
    html += field;
    html += "</body>";
    html += "</html>";

    w.document.write(html);
    w.document.close();

    setTimeout(function () {
        w.focus();
        w.print();
        if (!showChars) {
            $("div.puzzle-field").each(function (index) { $(this).removeClass("hide-char") });
        }
    }, 250);
}

// render server-side PDF and open it in a new tab
var renderPdf = function (mode) {
    window.open('/render-pdf/' + mode, '_blank');
}

// open buchstaben.com with the given word as a search (with empty cells)
var openBuchstabenCom = function () {
    var search = "";
    $(".puzzle-field.highlight").each(function (index) {
        let char = $(this).children("span").text();
        if (char == " ") {
            // add _
            search += "_";
        } else {
            search += char;
        }
    });
    window.open("https://buchstaben.com/amp/woerter-suchen?pattern=" + search);
    focusSelected();
}

// export board to base64 into user clipboard
var exportBoard = function () {

    // select this to clipboard
    var target = document.createElement("textarea");
    target.style.position = "absolute";
    target.style.left = "-9999px";
    target.style.top = "0";
    target.id = "_hiddenCopyText_";
    document.body.appendChild(target);
    target.textContent = btoa(JSON.stringify({ 'board': createBoardString(), "numbers": createNumberString(), "circles": createCircleString() }));
    target.focus();
    target.setSelectionRange(0, target.value.length);
    succeed = document.execCommand("copy");
    target.textContent = ""; // clear content
    alert("Copied to Clipboard!");
    focusSelected();
}

// prompt user for base64 string and import.
var importBoard = function () {
    var importText = prompt("Import Board:");
    if (importText !== null) {
        let dict = JSON.parse(atob(importText));
        parseBoardString(dict["board"]);
        parseNumbers(dict["numbers"]);
        parseCircles(dict["circles"]);
        sendBoard(); // send imported board back to server.
        doHighlighting();
        doButtonActives();
    }
}

// handle server sending board
socket.on('board', function (data) {
    parseBoardString(data["board"]);
    parseNumbers(data["numbers"]);
    parseCircles(data["circles"]);
});

// Send question for num users and board
$(document).ready(function () {
    getNumUsers();
    getBoard();
});