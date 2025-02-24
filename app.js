const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();
const port = 3500;

const FIREBASE_HOST = "https://saline-level-monitoring-server-default-rtdb.firebaseio.com";
const FIREBASE_AUTH = "63XsfziiFUKSfiv7HccwGizwRimnjmspbDldBEFv";

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Existing routes
app.get("/", (req, res) => {
   res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/home", (req, res) => {
   res.sendFile(path.join(__dirname, "public", "home.html"));
});

// Get all patient IDs
app.get("/api/patients", async (req, res) => {
   try {
     const response = await axios.get(`${FIREBASE_HOST}/patientIds.json?auth=${FIREBASE_AUTH}`);
     res.json(response.data);
   } catch (error) {
     res.status(500).json({ error: "Failed to fetch patient IDs" });
   }
});

// Get all saved passwords
app.get("/api/saline-passwords", async (req, res) => {
   try {
     const response = await axios.get(`${FIREBASE_HOST}/SalinePassword.json?auth=${FIREBASE_AUTH}`);
     res.json(response.data || {});
   } catch (error) {
     res.status(500).json({ 
       error: "Failed to fetch saved passwords",
       details: error.message 
     });
   }
});

// Get single password by key
app.get("/api/saline-passwords/:key", async (req, res) => {
   try {
     const { key } = req.params;
     const response = await axios.get(
       `${FIREBASE_HOST}/SalinePassword/${key}.json?auth=${FIREBASE_AUTH}`
     );
     
     if (!response.data) {
       return res.status(404).json({ 
         error: "Password not found",
         details: `No password found with key: ${key}`
       });
     }
     
     res.json(response.data);
   } catch (error) {
     console.error('Firebase fetch error:', error);
     res.status(500).json({
       error: "Failed to fetch password",
       details: error.message
     });
   }
});

// Save/Update password
app.post("/api/saline-passwords", async (req, res) => {
   try {
     const { patientId, password, expiryDateTime } = req.body;

     // Validate required fields
     if (!patientId || !password || !expiryDateTime) {
       return res.status(400).json({ 
         error: "Missing required fields",
         details: "patientId, password, and expiryDateTime are required"
       });
     }

     // Generate a unique key for the entry
     const newPasswordRef = await axios.post(
       `${FIREBASE_HOST}/SalinePassword.json?auth=${FIREBASE_AUTH}`,
       {
         patientId,
         password,
         expiryDateTime,
         createdAt: new Date().toISOString()
       }
     );

     res.status(201).json({
       success: true,
       message: "Password saved successfully",
       key: newPasswordRef.data.name
     });
   } catch (error) {
     console.error('Firebase save error:', error);
     res.status(500).json({
       error: "Failed to save password",
       details: error.message
     });
   }
});

// Update existing password
app.put("/api/saline-passwords/:key", async (req, res) => {
   try {
     const { key } = req.params;
     const { patientId, password, expiryDateTime } = req.body;

     // Validate required fields
     if (!patientId || !password || !expiryDateTime) {
       return res.status(400).json({ 
         error: "Missing required fields",
         details: "patientId, password, and expiryDateTime are required"
       });
     }

     await axios.put(
       `${FIREBASE_HOST}/SalinePassword/${key}.json?auth=${FIREBASE_AUTH}`,
       {
         patientId,
         password,
         expiryDateTime,
         updatedAt: new Date().toISOString()
       }
     );

     res.json({
       success: true,
       message: "Password updated successfully"
     });
   } catch (error) {
     console.error('Firebase update error:', error);
     res.status(500).json({
       error: "Failed to update password",
       details: error.message
     });
   }
});

// Delete password
app.delete("/api/saline-passwords/:key", async (req, res) => {
   try {
     const { key } = req.params;

     await axios.delete(
       `${FIREBASE_HOST}/SalinePassword/${key}.json?auth=${FIREBASE_AUTH}`
     );

     res.json({
       success: true,
       message: "Password deleted successfully"
     });
   } catch (error) {
     console.error('Firebase delete error:', error);
     res.status(500).json({
       error: "Failed to delete password",
       details: error.message
     });
   }
});

// Existing patient assignment API
app.post("/api/patient-assignment", async (req, res) => {
   try {
     const { patientId, wardNo, roomNo, bedNo } = req.body;
     
     await axios.patch(
       `${FIREBASE_HOST}/salinedetails.json?auth=${FIREBASE_AUTH}`,
       {
         [`patient-${patientId}`]: {
           linkwardno: wardNo,
           linkroomno: roomNo,
           linkbedno: bedNo
         }
       }
     );
     
     res.json({
       success: true,
       message: "Patient assignment saved successfully"
     });
   } catch (error) {
     console.error('Firebase save error:', error);
     res.status(500).json({
       error: "Failed to save patient assignment",
       details: error.message
     });
   }
});

//Api for deleting password after time over
async function deleteExpiredPasswords() {
  try {
    // Get all passwords
    const response = await axios.get(`${FIREBASE_HOST}/SalinePassword.json?auth=${FIREBASE_AUTH}`);
    const passwords = response.data;
    
    if (!passwords) {
      console.log('No passwords found in database');
      return 0;
    }
    
    const now = new Date().getTime(); // Get current time in milliseconds
    const deletionPromises = [];
    
    // Check each password for expiration
    Object.entries(passwords).forEach(([key, data]) => {
      const expiryDate = new Date(data.expiryDateTime).getTime();
      
      console.log(`Checking password ${key}:`);
      console.log(`- Expiry: ${data.expiryDateTime}`);
      console.log(`- Current time: ${new Date().toISOString()}`);
      console.log(`- Is expired: ${now >= expiryDate}`);
      
      if (now >= expiryDate) {
        console.log(`Deleting expired password with key: ${key}`);
        // Add to deletion queue if expired
        deletionPromises.push(
          axios.delete(`${FIREBASE_HOST}/SalinePassword/${key}.json?auth=${FIREBASE_AUTH}`)
            .then(() => console.log(`Successfully deleted password: ${key}`))
            .catch(error => console.error(`Error deleting password ${key}:`, error))
        );
      }
    });
    
    // Execute all deletions
    if (deletionPromises.length > 0) {
      await Promise.all(deletionPromises);
      console.log(`Deleted ${deletionPromises.length} expired passwords`);
    } else {
      console.log('No expired passwords found');
    }
    
    return deletionPromises.length;
  } catch (error) {
    console.error('Error in password cleanup:', error);
    throw error;
  }
}

// Set up automatic cleanup every 30 seconds for more frequent checking
setInterval(async () => {
  console.log('\nRunning scheduled password cleanup...');
  try {
    const deletedCount = await deleteExpiredPasswords();
    console.log(`Scheduled cleanup completed. Deleted ${deletedCount} passwords.`);
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
  }
}, 30000); // Check every 30 seconds

app.listen(port, () => {
   console.log(`Server running at http://localhost:${port}`);
});