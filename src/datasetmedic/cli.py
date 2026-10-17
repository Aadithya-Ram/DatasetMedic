import argparse
import multiprocessing
import socket
import threading
import webbrowser

import uvicorn

from datasetmedic.app import create_app


def main():
    multiprocessing.freeze_support()
    parser = argparse.ArgumentParser(description="DatasetMedic — inspect datasets locally.")
    parser.add_argument("--port", type=int, default=0, help="Local port (default: select a free port)")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    # Reserve the listening socket before opening the browser.
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", args.port))
    port = sock.getsockname()[1]
    print(f"DatasetMedic is running at http://127.0.0.1:{port}")
    print("Your datasets stay on this computer. Press Ctrl+C to stop and clear temporary data.")
    if not args.no_browser:
        threading.Timer(1.2, lambda: webbrowser.open(f"http://127.0.0.1:{port}")).start()
    server = uvicorn.Server(uvicorn.Config(create_app(), host="127.0.0.1", port=port, log_level="warning"))
    server.run(sockets=[sock])


if __name__ == "__main__":
    main()
