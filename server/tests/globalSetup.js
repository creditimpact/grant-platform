const net = require('net');

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port }, () => {
      socket.end();
      resolve();
    });
    socket.on('error', (err) => {
      reject(new Error(`Port ${port} not reachable: ${err.message}`));
    });
  });
}

module.exports = async () => {
  await Promise.all([checkPort(5000), checkPort(8002)]);
};
