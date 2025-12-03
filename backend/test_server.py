from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return "Hello World!"

if __name__ == '__main__':
    print("Starting test server on port 5001...")
    app.run(host='127.0.0.1', port=5001, debug=True)
