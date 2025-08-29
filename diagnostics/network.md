## Test-NetConnection Results
Port 3000: TcpTestSucceeded=True; RemotePort=3000; InterfaceAlias=Loopback Pseudo-Interface 1
Port 4001: TcpTestSucceeded=True; RemotePort=4001; InterfaceAlias=Loopback Pseudo-Interface 1
Port 5000: TcpTestSucceeded=True; RemotePort=5000; InterfaceAlias=Loopback Pseudo-Interface 1
Port 5001: TcpTestSucceeded=True; RemotePort=5001; InterfaceAlias=Loopback Pseudo-Interface 1
Port 8002: TcpTestSucceeded=True; RemotePort=8002; InterfaceAlias=Loopback Pseudo-Interface 1

## HTTP Reachability
http://localhost:5000/healthz -> 200
http://localhost:4001/healthz -> 200
http://localhost:5001/healthz -> 200
http://localhost:8002/healthz -> 200
