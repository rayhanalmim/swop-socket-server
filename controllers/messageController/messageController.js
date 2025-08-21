import asyncHandler from "express-async-handler";
import Message from "#models/messages/messagesModel.js";

const updateGroupMessage = asyncHandler(async (req, res) => {
  try {
    const { channelId, messageId } = req.params;
    const { content } = req.body;

    console.log("check", channelId, messageId, content);

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Message content is required." });
    }

    const updatedMessage = await Message.findOneAndUpdate(
      { channelId, _id: messageId },
      { $set: { content } },
      { new: true } // Return the updated document
    );

    if (!updatedMessage) {
      return res.status(404).json({ message: "Message not found." });
    }

    res
      .status(200)
      .json({ message: "Message updated successfully.", updatedMessage });
  } catch (error) {
    console.error("Error updating group message:", error);
    res.status(500).json({ message: "Server error." });
  }
});

const updateDirectMessage = asyncHandler(async (req, res) => {
  try {
    const { conversationId, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Message content is required." });
    }

    const updatedMessage = await Message.findOneAndUpdate(
      { conversationId, _id: messageId },
      { $set: { content } },
      { new: true } // Return the updated document
    );

    if (!updatedMessage) {
      return res.status(404).json({ message: "Message not found." });
    }

    res
      .status(200)
      .json({ message: "Message updated successfully.", updatedMessage });
  } catch (error) {
    console.error("Error updating direct message:", error);
    res.status(500).json({ message: "Server error." });
  }
});

export { updateGroupMessage, updateDirectMessage };
