const mongoose = require('mongoose');

// مخطط الردود
const ReplySchema = new mongoose.Schema({
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] } // من يحب الرد
});

// مخطط التعليقات مع الردود
const CommentSchema = new mongoose.Schema({
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  likes: { type: [String], default: [] }, // من يحب التعليق
  replies: { type: [ReplySchema], default: [] }
});

// مخطط المشروع الرئيسي
const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  html: { type: String, default: "" },
  css: { type: String, default: "" },
  js: { type: String, default: "" },
  author: { type: String, required: true },
  views: { type: Number, default: 0 },
  likes: { type: [String], default: [] },
  comments: { type: [CommentSchema], default: [] },
  ratings: {
    type: [{
      user: { type: String, required: true },
      value: { type: Number, min: 1, max: 5, required: true }
    }],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);
