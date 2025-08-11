const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const db = require("./db"); // Import database connection

const server = http.createServer(app);
const io = new Server(server);

let users = {}; // Store connected users

io.on("connection", (socket) => {
    console.log("A user connected");

    // Handle sending image as Base64 or URL without saving to DB
socket.on("private image", ({ to, imageData }) => {
  const recipientSocket = Object.keys(users).find(key => users[key] === to);

  if (recipientSocket) {
    io.to(recipientSocket).emit("private image", {
      from: socket.username,
      imageData, // base64 or image URL
      time: new Date().toISOString()
    });
  }
});

    // Store user when they join, insert if not exists
  socket.on("set username", (username) => {
    // Check if user exists
    db.query("SELECT id FROM users WHERE username = ?", [username], (err, results) => {
      if (err) {
        console.error("DB error on set username:", err);
        return;
      }

      if (results.length === 0) {
        // Insert user if not found
        db.query(
          "INSERT INTO users (username) VALUES (?)",
          [username],
          (err, insertResult) => {
            if (err) {
              console.error("DB error inserting user:", err);
              return;
            }
            console.log(`User ${username} inserted with id ${insertResult.insertId}`);

            // Now save username on socket and update list
            socket.username = username;
            users[socket.id] = username;
            io.emit("user list", Object.values(users));
          }
        );
      } else {
        // User exists, just save username
        socket.username = username;
        users[socket.id] = username;
        io.emit("user list", Object.values(users));
      }
    });
  });

    // Load chat history from the database
    socket.on("load messages", (chatWith) => {
        const sql = "SELECT sender, message, timestamp FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY timestamp";
        db.query(sql, [socket.username, chatWith, chatWith, socket.username], (err, results) => {
            if (err) {
                console.error("Error loading messages:", err);
            } else {
                socket.emit("chat history", results);
            }
        });
    });

// Inside 'private message' event handler:
socket.on("private message", ({ to, message }) => {
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");

  // Get sender_id and receiver_id
  db.query(
    "SELECT id, username FROM users WHERE username IN (?, ?)", 
    [socket.username, to], 
    (err, results) => {
      if (err) {
        console.error("Error fetching user IDs:", err);
        return;
      }
      if (results.length < 2) {
        console.error("Sender or receiver not found in users table");
        return;
      }

      let sender_id, receiver_id;
      results.forEach(user => {
        if (user.username === socket.username) sender_id = user.id;
        if (user.username === to) receiver_id = user.id;
      });

      const sql = "INSERT INTO messages (sender_id, receiver_id, sender, receiver, message, timestamp) VALUES (?, ?, ?, ?, ?, ?)";
      db.query(sql, [sender_id, receiver_id, socket.username, to, message, timestamp], (err) => {
        if (err) {
          console.error("Error saving message:", err);
          return;
        }

        // Send message to recipient socket if connected
        const recipientSocket = Object.keys(users).find(key => users[key] === to);
        if (recipientSocket) {
          io.to(recipientSocket).emit("private message", {
            from: socket.username,
            message,
            time: timestamp
          });
        }

        // Notify all users
        io.emit("new_message", {
          from: socket.username,
          to: to,
          message,
          time: timestamp
        });
      });
    }
  );
});



    // User disconnects
    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("user list", Object.values(users));
        console.log("A user disconnected");
    });
});
 
// Start the server
const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});