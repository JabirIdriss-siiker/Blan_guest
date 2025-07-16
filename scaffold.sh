#!/usr/bin/env bash
set -e

echo "🛠️  Démarrage du scaffolding MERN + Nuxt3..."

########################
# 1. Structure générale
########################
mkdir -p backend/{src/{controllers,models,routes,utils},config,tests}
mkdir -p frontend/{assets,components,layouts,middleware,pages,plugins,static,store}

########################
# 2. Backend : package.json & deps
########################
cat > backend/package.json << 'EOF'
{
  "name": "gestion-logements-backend",
  "version": "1.0.0",
  "main": "src/app.js",
  "scripts": {
    "dev": "nodemon src/app.js",
    "start": "node src/app.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.2.0",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "node-fetch": "^3.3.1",
    "ical": "^0.8.0",
    "nodemailer": "^6.9.1",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.22",
    "jest": "^29.5.0",
    "supertest": "^6.3.3"
  }
}
EOF

########################
# 3. Backend : .env.example
########################
cat > backend/.env.example << 'EOF'
MONGODB_URI=your_mongo_connection_string
JWT_SECRET=une_phrase_secrete
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=utilisateur
MAIL_PASS=motdepasse
EOF

########################
# 4. Backend : src/app.js
########################
cat > backend/src/app.js << 'EOF'
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// TODO: importer routes
// const authRoutes = require('./routes/auth');
// app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ Connecté à MongoDB');
    app.listen(PORT, () => console.log(\`🚀 Backend running on port \${PORT}\`));
  })
  .catch(err => console.error('❌ Erreur MongoDB:', err));
EOF

########################
# 5. Backend : modèle User (Mongoose)
########################
cat > backend/src/models/User.js << 'EOF'
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['Admin','Manager','Staff'], default: 'Staff' }
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);
EOF

########################
# 6. Frontend : package.json & Nuxt3 setup
########################
cat > frontend/package.json << 'EOF'
{
  "name": "gestion-logements-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "start": "nuxt start"
  },
  "dependencies": {
    "nuxt": "^3.6.0",
    "vue-i18n": "^9.2.3",
    "@nuxtjs/tailwindcss": "^6.0.0",
    "axios": "^1.3.4",
    "@pinia/nuxt": "^0.4.12"
  }
}
EOF

########################
# 7. Frontend : nuxt.config.ts
########################
cat > frontend/nuxt.config.ts << 'EOF'
import { defineNuxtConfig } from 'nuxt'

export default defineNuxtConfig({
  target: 'server',
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt'
  ],
  css: ['@/assets/main.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:5000/api'
    }
  },
  i18n: {
    locales: ['fr'],
    defaultLocale: 'fr',
    vueI18n: {
      locale: 'fr',
      messages: {
        fr: {} // à compléter
      }
    }
  }
})
EOF

########################
# 8. Frontend : Tailwind (assets/main.css)
########################
cat > frontend/assets/main.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

########################
# 9. Frontend : page d'accueil (pages/index.vue)
########################
cat > frontend/pages/index.vue << 'EOF'
<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">Bienvenue dans l'outil de gestion de logements</h1>
    <p>Connectez-vous pour accéder au tableau de bord.</p>
    <NuxtLink to="/login" class="mt-4 inline-block btn">Se connecter</NuxtLink>
  </div>
</template>
EOF

########################
# 10. Frontend : page login (pages/login.vue)
########################
cat > frontend/pages/login.vue << 'EOF'
<template>
  <div class="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
    <h2 class="text-xl mb-4">Connexion</h2>
    <form @submit.prevent="submit">
      <input v-model="email" type="email" placeholder="Email" class="w-full mb-2 p-2 border rounded" />
      <input v-model="password" type="password" placeholder="Mot de passe" class="w-full mb-4 p-2 border rounded" />
      <button type="submit" class="w-full btn">Se connecter</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const router = useRouter()

async function submit() {
  try {
    const { data } = await axios.post(useRuntimeConfig().public.apiBase + '/auth/login', { email: email.value, password: password.value })
    localStorage.setItem('token', data.token)
    router.push('/dashboard')
  } catch (err) {
    alert('Erreur de connexion')
  }
}
</script>
EOF

########################
# 11. README (français)
########################
cat > README.md << 'EOF'
# App Gestion de Logements (MVP)

## Installation

### Backend
```bash
cd backend
cp .env.example .env
# remplir .env
npm install
npm run dev
