const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    pass: process.env.SMTP_PASS || 'your-app-password',
  },
});

const sendMissionNotification = async (mission) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER || 'your-email@gmail.com',
      to: mission.assignedTo.email,
      subject: `Nouvelle mission assignée: ${mission.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563EB;">Nouvelle Mission Assignée</h2>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1e40af; margin-top: 0;">${mission.title}</h3>
            <p><strong>Appartement:</strong> ${mission.apartment.name}</p>
            <p><strong>Adresse:</strong> ${mission.apartment.address}</p>
            <p><strong>Date de début:</strong> ${new Date(mission.dateDebut).toLocaleDateString('fr-FR')}</p>
            <p><strong>Date de fin:</strong> ${new Date(mission.dateFin).toLocaleDateString('fr-FR')}</p>
            <p><strong>Priorité:</strong> ${mission.priority}</p>
          </div>
          
          ${mission.description ? `
            <div style="margin: 20px 0;">
              <h4>Description:</h4>
              <p>${mission.description}</p>
            </div>
          ` : ''}
          
          ${mission.instructions ? `
            <div style="margin: 20px 0;">
              <h4>Instructions spéciales:</h4>
              <p>${mission.instructions}</p>
            </div>
          ` : ''}
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/missions/${mission._id}" 
               style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Voir la mission
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
            Vous recevez cet email car une nouvelle mission vous a été assignée dans le système de gestion des missions de nettoyage.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Email de notification envoyé à:', mission.assignedTo.email);
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    throw error;
  }
};

module.exports = {
  sendMissionNotification,
};