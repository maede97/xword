from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from multiprocessing import Value, Array
from ctypes import c_wchar_p
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default_secret_key')

socketio = SocketIO(app)

online_users = Value('i', 0)
puzzle_size = 15

board = Value(c_wchar_p, " " * puzzle_size * puzzle_size)
numbers = Array('i', [0] * puzzle_size * puzzle_size)
circles = Array('i', [0] * puzzle_size * puzzle_size)


@app.route('/')
def index():
    return render_template("index.html")


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
             "numbers": numbers.value, "circles": circles.value})


@socketio.on("update-board")
def updateBoard(data):
    with board.get_lock(), numbers.get_lock(), circles.get_lock():
        board.value = data["board"]
        numbers.value = data["numbers"]
        circles.value = data["circles"]
        emit("board", {"board": board.value, "numbers": numbers.value,
             "circles": circles.value}, broadcast=True)


@socketio.on("server-load")
def loadPuzzle():
    with board.get_lock(), numbers.get_lock(), circles.get_lock():
        board.value = open("/app/data/board.txt").read()
        numbers.value = eval(open("/app/data/numbers.txt").read())
        circles.value = eval(open("/app/data/circles.txt").read())
        emit("board", {"board": board.value, "numbers": numbers.value,
             "circles": circles.value}, broadcast=True)


@socketio.on("server-store")
def storePuzzle():
    with board.get_lock(), numbers.get_lock(), circles.get_lock():
        with open("/app/data/board.txt", "w") as wr:
            wr.write(board.value)
        with open("/app/data/numbers.txt", "w") as wr:
            wr.write(str(numbers.value))
        with open("/app/data/circles.txt", "w") as wr:
            wr.write(str(circles.value))


if __name__ == '__main__':
    socketio.run(app)
