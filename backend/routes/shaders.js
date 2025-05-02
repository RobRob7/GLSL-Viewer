// routes/shaders.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Shader = require('../models/Shader');

// Get all shaders for user
router.get('/', auth, async (req, res) => {
    try {
        const shaders = await Shader.find({ user: req.user.id }).sort('-updatedAt');
        res.json(shaders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Create new shader
router.post('/', auth, async (req, res) => {
    try {
        const { title, code } = req.body;

        const shader = new Shader({
            user: req.user.id,
            title,
            code
        });

        await shader.save();
        res.status(201).json(shader);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// get specific shader
router.get('/:id', auth, async (req, res) => {
    try {
        const shader = await Shader.findOne(
            { _id: req.params.id, user: req.user.id }
        );

        if (!shader) return res.status(404).json({ message: 'Shader not found' });
        res.json(shader);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update shader
router.put('/:id', auth, async (req, res) => {
    try {
        const { code } = req.body;
        const shader = await Shader.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { code, updatedAt: Date.now() },
            { new: true }
        );

        if (!shader) return res.status(404).json({ message: 'Shader not found' });
        res.json(shader);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const shader = await Shader.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!shader) return res.status(404).json({ message: 'Shader not found' });
        res.json({ message: 'Shader deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update shader
router.put('/update-name/:id', express.json(), async (req, res) => {
    try {
        const updates = {};
        if (req.body.title) updates.title = req.body.title;
        if (req.body.code) updates.code = req.body.code;
        updates.updatedAt = Date.now();
        const shader = await Shader.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true }
        );
        if (!shader) {
            return res.status(404).json({ error: 'Shader not found' });
        }
        res.json(shader);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;