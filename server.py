from flask import Flask, Response, render_template
from flask_socketio import SocketIO, emit
from multiprocessing import Value, Array
from ctypes import c_wchar_p
from io import BytesIO
import ast
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import black, white
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default_secret_key')

socketio = SocketIO(app)

online_users = Value('i', 0)
puzzle_size = int(os.environ.get('PUZZLE_SIZE', 15))

board = Value(c_wchar_p, " " * puzzle_size * puzzle_size)
numbers = Array('i', [0] * puzzle_size * puzzle_size)
circles = Array('i', [0] * puzzle_size * puzzle_size)


@app.route('/')
def index():
    return render_template("index.html")


def _board_state_to_cells(board_value, numbers_value, circles_value):
    cells = []
    for i in range(puzzle_size):
        row = []
        for j in range(puzzle_size):
            idx = i * puzzle_size + j
            char = board_value[idx] if idx < len(board_value) else " "
            row.append({
                "char": char,
                "number": int(numbers_value[idx]),
                "circle": int(circles_value[idx]),
                "black": char == "#",
            })
        cells.append(row)
    return cells


def _array_to_list(sync_array):
    return list(sync_array[:])


def _set_array(sync_array, values):
    sync_array[:] = list(values)


def _render_pdf(mode, cells):
    packet = BytesIO()
    page_width, page_height = A4
    pdf = canvas.Canvas(packet, pagesize=A4)

    board_size = min(page_width, page_height) * 0.8
    cell_size = board_size / puzzle_size
    offset_x = (page_width - board_size) / 2
    offset_y = (page_height - board_size) / 2

    show_solution = mode == "solution"

    for i in range(puzzle_size):
        for j in range(puzzle_size):
            cell = cells[i][j]
            x = offset_x + j * cell_size
            y = offset_y + (puzzle_size - 1 - i) * cell_size

            if cell["black"]:
                pdf.setFillColor(black)
                pdf.rect(x, y, cell_size, cell_size, fill=1, stroke=1)
                continue

            pdf.setFillColor(white)
            pdf.rect(x, y, cell_size, cell_size, fill=1, stroke=1)

            if not show_solution and cell["circle"]:
                radius = cell_size * 0.35
                pdf.circle(x + cell_size / 2, y + cell_size / 2, radius, stroke=1, fill=0)

            if not show_solution and cell["number"] > 0:
                pdf.setFillColor(black)
                pdf.setFont("Helvetica", max(5, cell_size * 0.18))
                pdf.drawString(x + cell_size * 0.08, y + cell_size * 0.78, str(cell["number"]))

            if show_solution:
                char = cell["char"].strip()
                if char:
                    pdf.setFillColor(black)
                    pdf.setFont("Helvetica-Bold", max(10, cell_size * 0.45))
                    width = pdf.stringWidth(char, "Helvetica-Bold", max(10, cell_size * 0.45))
                    pdf.drawString(x + (cell_size - width) / 2, y + cell_size * 0.27, char)

    pdf.showPage()
    pdf.save()
    packet.seek(0)
    return packet.read()


@app.route('/render-pdf/<mode>')
def render_pdf(mode):
    if mode not in {"solution", "empty"}:
        return Response("Mode must be 'solution' or 'empty'", status=400)

    with board.get_lock(), numbers.get_lock(), circles.get_lock():
        cells = _board_state_to_cells(board.value, _array_to_list(numbers), _array_to_list(circles))

    pdf_bytes = _render_pdf(mode, cells)
    return Response(
        pdf_bytes,
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'inline; filename="xword-{mode}.pdf"'
        }
    )


@socketio.on('get-online-people')
def handleGetOnlinePeople():
    # send online people to all users
    with online_users.get_lock():
        emit('get-online-people',
             {'online-users': online_users.value}, broadcast=True)


@socketio.on('connection')
def handleConnection(_=None):
    with online_users.get_lock():
        online_users.value += 1
        sendPuzzleSize()
        handleGetOnlinePeople()


@socketio.on('disconnect')
def handleDisconnect(_=None):
    with online_users.get_lock():
        online_users.value -= 1
        handleGetOnlinePeople()


@socketio.on("puzzlesize")
def sendPuzzleSize():
    emit("puzzlesize", {"size": puzzle_size})


@socketio.on("board")
def sendBoard():
    with board.get_lock(), numbers.get_lock(), circles.get_lock():
        emit("board", {"board": board.value,
             "numbers": _array_to_list(numbers), "circles": _array_to_list(circles)})


@socketio.on("update-board")
def updateBoard(data):
    with board.get_lock(), numbers.get_lock(), circles.get_lock():
        board.value = data["board"]
        _set_array(numbers, data["numbers"])
        _set_array(circles, data["circles"])
        emit("board", {"board": board.value, "numbers": _array_to_list(numbers),
             "circles": _array_to_list(circles)}, broadcast=True)


@socketio.on("server-load")
def loadPuzzle():
    with board.get_lock(), numbers.get_lock(), circles.get_lock():
        board.value = open("/app/data/board.txt").read()
        _set_array(numbers, ast.literal_eval(open("/app/data/numbers.txt").read()))
        _set_array(circles, ast.literal_eval(open("/app/data/circles.txt").read()))
        emit("board", {"board": board.value, "numbers": _array_to_list(numbers),
             "circles": _array_to_list(circles)}, broadcast=True)


@socketio.on("server-store")
def storePuzzle():
    with board.get_lock(), numbers.get_lock(), circles.get_lock():
        with open("/app/data/board.txt", "w") as wr:
            wr.write(board.value)
        with open("/app/data/numbers.txt", "w") as wr:
            wr.write(str(_array_to_list(numbers)))
        with open("/app/data/circles.txt", "w") as wr:
            wr.write(str(_array_to_list(circles)))


if __name__ == '__main__':
    socketio.run(app)
