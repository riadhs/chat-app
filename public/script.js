const socket = io();
let username = "";
let chatWith = "";

// Store unread messages for each user
let unreadMessages = {};

// Set username and show user list
function setUsername() {
    username = document.getElementById("username").value.trim();
    if (username) {
        socket.emit("set username", username);
        document.title = `${username} - Private Chat`; // Update title with username
        document.getElementById("username-container").style.display = "none";
        document.getElementById("chat-container").style.display = "flex";
    }
}

// Update user list with unread message count and notification
socket.on("user list", (users) => {
    const userList = document.getElementById("user-list");
    userList.innerHTML = ""; // Clear user list but re-render it entirely

    // Keep the user list visible, only append unread notifications
    users.forEach(user => {
        if (user !== username) {
            const userElement = document.createElement("div");
            userElement.classList.add("user");
            userElement.innerHTML = `${user}`;

            // Add a notification if there are unread messages
            if (unreadMessages[user]) {
                const notification = document.createElement("span");
                notification.classList.add("unread");
                userElement.appendChild(notification);
            }

            userElement.onclick = () => selectUser(user);

            userList.appendChild(userElement);
        }
    });
});

// Select user for private chat and load unread messages
function selectUser(user) {
    chatWith = user;
    document.getElementById("chat-with").innerText = user;
    document.getElementById("messages").innerHTML = ""; // Clear chat

    // Request message history from the server
    socket.emit("load messages", user);

    // Remove notification once the chat is opened
    unreadMessages[user] = false;
    socket.emit("user read messages", user); // Notify server that the user read the messages
}

// Load unread messages into the chat window
socket.on("chat history", (messages) => {
    messages.forEach(msg => displayMessage(msg.sender, msg.message, msg.timestamp));
});

// Send private message
function sendMessage() {
    const input = document.getElementById("message-input");
    const message = input.value.trim();
    if (message && chatWith) {
        // Emit the message with sender's username, receiver (chatWith), and the message
        socket.emit("private message", { from: username, to: chatWith, message: message });
        displayMessage(username, message, new Date().toISOString());
        input.value = ""; // Clear input
    }
}

// Display messages in chat window
function displayMessage(from, message, time) {
    const messageBox = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.innerHTML = `<strong>${from}</strong> (${new Date(time).toLocaleTimeString()}): ${message}`;
    messageBox.appendChild(messageElement);
    messageBox.scrollTop = messageBox.scrollHeight; // Auto-scroll to latest message
}

// Receive private messages
socket.on("private message", (data) => {
    if (data.from === chatWith) {
        displayMessage(data.from, data.message, data.time);
    } else {
        // Mark as unread if the user is not in the chat with the sender
        if (!unreadMessages[data.from]) {
            unreadMessages[data.from] = true;
            updateUserList(); // Update the user list to show notification
        }
    }
});

// Listen for new message notifications (even if the user isn't in the chat with the sender)
socket.on("new_message", (data) => {
    if (data.to === username && chatWith !== data.from) {
        // Mark the message as unread
        if (!unreadMessages[data.from]) {
            unreadMessages[data.from] = true;
            updateUserList(); // Update the user list to show notification
        }
    }
});

// Update the user list to show unread message notifications
function updateUserList() {
    const userList = document.getElementById("user-list");
    
    // Iterate over all users and only update unread notification indicators
    const userElements = Array.from(userList.children);
    userElements.forEach(userElement => {
        const usernameInList = userElement.innerText;
        
        if (unreadMessages[usernameInList]) {
            // Add or update notification for unread messages
            if (!userElement.querySelector(".unread")) {
                const notification = document.createElement("span");
                notification.classList.add("unread");
                userElement.appendChild(notification);
            }
        } else {
            // Remove notification if no unread messages
            const notification = userElement.querySelector(".unread");
            if (notification) {
                userElement.removeChild(notification);
            }
        }
    });
}


// Send image with resizing & compression
function sendImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxSize = 800; // max width or height to resize

      let width = img.width;
      let height = img.height;

      // Calculate new size maintaining aspect ratio
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Get the image type from original file
      const imageType = file.type || "image/png";

      // Compress quality 0.8 for jpeg/webp, ignored for png
      const base64Image = canvas.toDataURL(imageType, 0.8);

      socket.emit("private image", { to: chatWith, imageData: base64Image });
      displayImage(username, base64Image, new Date().toISOString()); //for clientside display
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// Listen for incoming images
socket.on("private image", (data) => {
  if (data.from === chatWith) {
    displayImage(data.from, data.imageData, data.time);
  } else {
    unreadMessages[data.from] = true;
    updateUserList();
  }
});

// Display image in chat
function displayImage(from, imageData, time) {
  const messageBox = document.getElementById("messages");
  const imgElement = document.createElement("img");
  imgElement.src = imageData;
  imgElement.style.maxWidth = "200px";
  imgElement.style.maxHeight = "200px";
  imgElement.alt = `Image from ${from}`;

  const container = document.createElement("div");
  container.classList.add("message");
  container.innerHTML = `<strong>${from}</strong> (${new Date(time).toLocaleTimeString()}):<br>`;
  container.appendChild(imgElement);

  messageBox.appendChild(container);
  messageBox.scrollTop = messageBox.scrollHeight;
}

function uploadImage() {
  const fileInput = document.getElementById("image-input");
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];

    // Optional: check if the file is an image before sending
    if (file.type.startsWith("image/")) {
      sendImage(file);
      fileInput.value = ""; // Clear after sending
    } else {
      alert("Please select a valid image file.");
    }
  }
}


