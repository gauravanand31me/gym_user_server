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
const PushNotification = require("./models/PushNotification")
const { sendPushNotification } = require("./config/pushNotification")
const MessageRequest = require("./models/MessageRequest")

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
  socket.on("send_message", async (data) => {
    console.log("📨 Message received:", data);
  
    const t = await sequelize.transaction();
  
    try {
      // Emit message to room first
      io.to(data.chatId).emit("receive_message", data);
  
      // 1️⃣ Save message
      const message = await Message.create({
        chat_id: data.chatId,
        sender_id: data.senderId,
        receiver_id: data.receiverId,
        text: data.text,
        message_type: "text",
        request: data.request || false,
      }, { transaction: t });
  
      // 2️⃣ Check if MessageRequest already exists
      let requestRecord = await MessageRequest.findOne({
        where: { chat_id: data.chatId, receiver_id: data.receiverId },
        transaction: t
      });
  
      // 3️⃣ If NOT exists → insert one
      if (!requestRecord) {
        
  
        requestRecord = await MessageRequest.create({
          chat_id: data.chatId,
          receiver_id: data.receiverId,
          status: data.request,
        }, { transaction: t });
  
        console.log("🆕 MessageRequest created:", status);
      } else {
        console.log("⚠️ MessageRequest already exists — skipping insert");
      }
  
      await t.commit();
  
      // 4️⃣ Push Notification (unchanged)
      const notificationData = await PushNotification.findOne({
        where: { userId: data.receiverId }
      });
  
      if (notificationData?.expoPushToken) {
        await sendPushNotification(notificationData.expoPushToken, {
          title: "New message",
          body: data.text,
        });
      }
  
      console.log("💾 Message stored + request handled");
  
    } catch (err) {
      await t.rollback();
      console.error("❌ send_message error:", err);
    }
  });
  

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
