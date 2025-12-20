require("dotenv").config()

const express = require("express")
const http = require("http")
const cors = require("cors")
const sequelize = require("./config/db")

const authRoutes = require("./routes/auth")
const gymRoutes = require("./routes/gym")
const bookingRoutes = require("./routes/booking")
const userRoutes = require("./routes/users")
const friendRoutes = require("./routes/friends")
const addressRoutes = require("./routes/address")
const buddyRoutes = require("./routes/buddy")
const notificationRoutes = require("./routes/notification")
const ratingRoutes = require("./routes/rating")
const checkUserAgent = require("./checkUserAgent")

// 🔥 SOCKET.IO
const { Server } = require("socket.io")
const Message = require("./models/Message")

const app = express()

app.use(express.json({
  limit: "200mb",
  verify: (req, res, buf) => {
    req.rawBody = buf
  },
}))
app.use(express.urlencoded({ limit: "200mb", extended: true }))
app.use(cors())
app.use(checkUserAgent)

// REST ROUTES
app.use("/user/api/auth", authRoutes)
app.use("/user/api/gym", gymRoutes)
app.use("/user/api/booking", bookingRoutes)
app.use("/user/api/users", userRoutes)
app.use("/user/api/friends", friendRoutes)
app.use("/user/api/address", addressRoutes)
app.use("/user/api/buddy", buddyRoutes)
app.use("/user/api/notifications", notificationRoutes)
app.use("/user/api/rating", ratingRoutes)

const PORT = process.env.PORT || 5000

// 🔥 CREATE HTTP SERVER
const server = http.createServer(app)

// 🔥 INIT SOCKET.IO
const io = new Server(server, {
  path: "/user/api/socket.io",
  cors: {
    origin: "*",
  },
})

/* =====================================================
   SOCKET.IO CHAT LOGIC
===================================================== */

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id)

  // Join chat room
  socket.on("join_room", (chatId) => {
    socket.join(chatId)
    console.log(`📥 Socket ${socket.id} joined room ${chatId}`)
  })

  // Receive & broadcast message
  socket.on("send_message",  (data) => {
    /*
      data = {
        id,
        chatId,
        senderId,
        receiverId,
        text,
        timestamp
      }
    */

    console.log("📨 Message received:", data)

    // Send message to all users in room
    io.to(data.chatId).emit("receive_message", data)


    Message.create({
      chat_id: data.chatId,
      sender_id: data.senderId,
      receiver_id: data.receiverId,
      text: data.text,
      message_type: "text",
    });

    console.log("Inserted in Database...")
    // 🔥 OPTIONAL (later)
    // Save message to DB here
  })

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id)
  })
})

/* =====================================================
   START SERVER
===================================================== */

sequelize
  .sync()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
    })
  })
  .catch((err) => console.log("DB Error:", err))
