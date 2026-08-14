const mongoose = require('mongoose');

const ReplySchema = new mongoose.Schema({
    author: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: null },
    edited: { type: Boolean, default: false }
}, { _id: true });

const CommentSchema = new mongoose.Schema({
    author: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: null },
    edited: { type: Boolean, default: false },
    replies: { type: [ReplySchema], default: [] }
}, { _id: true });

const RatingSchema = new mongoose.Schema({
    user: { type: String, required: true },
    value: { type: Number, required: true, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: null }
}, { _id: true });

const ProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    html: { type: String, default: '' },
    css: { type: String, default: '' },
    js: { type: String, default: '' },
    author: { type: String, required: true },
    views: { type: Number, default: 0 },
    likes: { type: [String], default: [] },
    comments: { type: [CommentSchema], default: [] },
    ratings: { type: [RatingSchema], default: [] },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
}, {
    timestamps: true,
    strict: false
});

module.exports = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
