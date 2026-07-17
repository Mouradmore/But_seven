const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date } // يفيد في ميزة "تم التعديل"
});

const CommentSchema = new mongoose.Schema({
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  replies: {
    type: [ReplySchema],
    default: []
  }
});

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  html: { type: String, default: "" },
  css: { type: String, default: "" },
  js: { type: String, default: "" },
  author: { type: String, required: true },
  views: { type: Number, default: 0 },
  likes: { type: [String], default: [] },
  comments: [CommentSchema]
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
