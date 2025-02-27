
const { db } = require('../config/db');
const cloudinary = require('../config/cloudinaryConfig'); // Import Cloudinary


const CreateActivity = async (req, res) => {
  const {
    activityInfo,
    locationInfo,
    scheduleInfo,
    participantsInfo,
    priceInfo,
    imagesInfo,
    hostInfo,
  } = req.body;

  console.log('Received Data:', {
    activityInfo,
    locationInfo,
    scheduleInfo,
    participantsInfo,
    priceInfo,
    imagesInfo,
    hostInfo,
  });

  // Validate input fields
  if (!activityInfo || !locationInfo || !scheduleInfo || !participantsInfo || !priceInfo) {
    return res.status(400).send({ error: 'Required fields are missing.' });
  }
  if (!imagesInfo.activityImages || imagesInfo.activityImages.length < 3) {
    return res.status(400).send({ error: 'At least 3 activity images are required.' });
  }
  if (!imagesInfo.profileImage?.uri) {
    return res.status(400).send({ error: 'A profile image is required.' });
  }
  try {
    const uploadedActivityImages = [];
    let certificateUri = ''; // Initialize as empty string instead of using hostInfo.certificateUri

    // **Upload Activity Images**
    for (const image of imagesInfo.activityImages) {
      if (image.uri) {
        const result = await cloudinary.uploader.upload(image.uri, {
          folder: 'touristguide/activityImages',
        });
        uploadedActivityImages.push(result.secure_url);
      }
    }

    // **Upload Profile Image**
    let profileImageUri = null;
    if (imagesInfo.profileImage?.uri) {
      const profileResult = await cloudinary.uploader.upload(imagesInfo.profileImage.uri, {
        folder: 'touristguide/profileImages',
      });
      profileImageUri = profileResult.secure_url;
    }

    // **Upload Certificate if Provided**
    if (hostInfo.file?.uri) {
      const certificateResult = await cloudinary.uploader.upload(hostInfo.file.uri, {
        folder: 'touristguide/certificates',
        resource_type: 'raw',
      });
      certificateUri = certificateResult.secure_url;
    }
    // If no certificate uploaded, certificateUri remains empty string

    // **Save to Firebase**
    const newActivityRef = db.ref('activities').push();
    const newActivityId = newActivityRef.key;

    const newActivity = {
      activityId: newActivityId,
      ...activityInfo,
      ...locationInfo,
      ...scheduleInfo,
      ...participantsInfo,
      ...priceInfo,
      activityImages: uploadedActivityImages,
      profileImage: profileImageUri,
      certificateUri, // Will now always be either URL or empty string
      companyName: hostInfo.companyName || '',
      cnic: hostInfo.cnic,
      phoneNumber: hostInfo.phoneNumber,
      hostId: hostInfo.hostId,
      status: 'Pending',
      listingStatus: 'List',
      createdAt: new Date().toISOString(),
    };

    await newActivityRef.set(newActivity);

    console.log('Activity Created Successfully:', newActivityId);
    res.status(201).send({ message: 'Activity created successfully!', activityId: newActivityId });
  } catch (error) {
    console.error('Error creating activity:', error.message);
    res.status(500).send({ error: 'Failed to create activity.' });
  }
};

const uploadToCloudinary = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file received' });
    }



    const { fileType } = req.body;
    const folder = fileType === 'activityImage' ? 'touristguide/activityImages' :
      fileType === 'profileImage' ? 'touristguide/profileImages' :
        'touristguide/certificates';


    console.log('Incoming File Data:', req.file);



    // Convert buffer to base64 for Cloudinary upload
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(fileBase64, {
      folder,
      resource_type: fileType === 'certificate' ? 'raw' : 'image',
    });

    console.log('Uploaded to Cloudinary:', result.secure_url);
    res.status(201).json({ url: result.secure_url });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error.message);
    res.status(500).json({ error: 'Server error during file upload.' });
  }
};


module.exports = {
  uploadToCloudinary,
  CreateActivity
};












