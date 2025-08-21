import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
export async function uploadObject(key, file, mimetype) {
  const client = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    forcePathStyle: false,
    region: 'sgp1',
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SPACES_SECRET,
    },
  });

  const uploadParams = {
    Bucket: process.env.BUCKET,
    Key: key,
    Body: file,
    ACL: 'public-read',
    Metadata: {},
    ContentType: mimetype ? mimetype : 'image',
  };

  try {
    const data = await client.send(new PutObjectCommand(uploadParams));
    console.log(
      'Successfully uploaded object: ' +
        uploadParams.Bucket +
        '/' +
        uploadParams.Key,
    );
    return data;
  } catch (err) {
    console.log('Error', err);
  }
}

export async function deleteObject(key) {
  const client = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com', // Find your endpoint in the control panel, under Settings. Prepend "https://".
    forcePathStyle: false,
    region: 'sgp1', // Must be "us-east-1" when creating new Spaces. Otherwise, use the region in your endpoint (e.g. nyc3).
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID, // Access key pair. You can create access key pairs using the control panel or API.
      secretAccessKey: process.env.SPACES_SECRET, // Secret access key defined through an environment variable.
    },
  });

  const deleteParams = {
    Bucket: process.env.BUCKET, // The path to the directory you want to upload the object to, starting with your Space name.
    Key: key, // Object key, referenced whenever you want to access this file later.
  };

  try {
    const data = await client.send(new DeleteObjectCommand(deleteParams));
    console.log(
      'Successfully deleted object: ' +
        deleteParams.Bucket +
        '/' +
        deleteParams.Key,
    );
    return data;
  } catch (err) {
    console.log('Error', err);
  }
}

export async function updateObject(createKey, file, deleteKey, mimetype) {
  const client = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com', // Find your endpoint in the control panel, under Settings. Prepend "https://".
    forcePathStyle: false,
    region: 'sgp1', // Must be "us-east-1" when creating new Spaces. Otherwise, use the region in your endpoint (e.g. nyc3).
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID, // Access key pair. You can create access key pairs using the control panel or API.
      secretAccessKey: process.env.SPACES_SECRET, // Secret access key defined through an environment variable.
    },
  });

  const uploadParams = {
    Bucket: process.env.BUCKET, // The path to the directory you want to upload the object to, starting with your Space name.
    Key: createKey, // Object key, referenced whenever you want to access this file later.
    Body: file, // The object's contents. This variable is an object, not a string.
    ACL: 'public-read', // Defines ACL permissions, such as private or public.
    Metadata: {
      // Defines metadata tags.
      // "x-amz-meta-my-key": "your-value"
    },
    ContentType: mimetype ? mimetype : 'image',
  };

  const deleteParams = {
    Bucket: process.env.BUCKET, // The path to the directory you want to upload the object to, starting with your Space name.
    Key: deleteKey, // Object key, referenced whenever you want to access this file later.
  };

  try {
    await client.send(new PutObjectCommand(uploadParams));
    console.log(
      'Successfully uploaded object: ' +
        uploadParams.Bucket +
        '/' +
        uploadParams.Key,
    );
    // return data;
  } catch (err) {
    console.log('Error', err);
  }

  try {
    await client.send(new DeleteObjectCommand(deleteParams));
    console.log(
      'Successfully deleted object: ' +
        deleteParams.Bucket +
        '/' +
        deleteParams.Key,
    );
    // return data;
  } catch (err) {
    console.log('Error', err);
  }
}

// Function to upload buffer to DigitalOcean Spaces
export async function uploadBuffer(key, fileBuffer, mimetype) {
  const client = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SPACES_SECRET,
    },
  });

  const uploadParams = {
    Bucket: process.env.BUCKET,
    Key: key,
    Body: fileBuffer, // Using buffer directly
    ACL: 'public-read', // Make file publicly accessible
    ContentType: mimetype || 'application/octet-stream',
  };

  try {
    await client.send(new PutObjectCommand(uploadParams));
    console.log(`Successfully uploaded file to: ${uploadParams.Bucket}/${uploadParams.Key}`);
    return uploadParams.Key; // Return upload result
  } catch (err) {
    console.error('Error uploading buffer:', err.message);
    throw new Error('Failed to upload file to DigitalOcean Spaces');
  }
}

