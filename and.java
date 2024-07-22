package com.example.salineapp;

import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.InputMethodManager;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.lifecycle.Observer;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    private EditText searchBar;
    private ImageButton searchIcon;
    private Switch startButton;
    private RecyclerView recyclerView;
    private MonitoringDataAdapter adapter;
    private List<MonitoringData> dataList;
    private List<MonitoringData> filteredList;

    private DatabaseReference databaseReference;
    private String lastSearchQuery = "";
    private static final String PREFS_NAME = "SalineAppPrefs";
    private static final String PREFS_KEY_SERVICE_ACTIVE = "ServiceActive";

    private void openPdf() {
        // Copy the PDF file from assets to a temporary file in external storage
        File pdfFile = new File(getExternalFilesDir(null), "about_us.pdf");
        try {
            InputStream inputStream = getAssets().open("about_us.pdf");
            FileOutputStream outputStream = new FileOutputStream(pdfFile);
            byte[] buffer = new byte[1024];
            int length;
            while ((length = inputStream.read(buffer)) > 0) {
                outputStream.write(buffer, 0, length);
            }
            inputStream.close();
            outputStream.close();
        } catch (IOException e) {
            e.printStackTrace();
            Toast.makeText(this, "Error opening PDF file", Toast.LENGTH_SHORT).show();
            return;
        }

        // Get the URI of the temporary file
        Uri pdfUri = FileProvider.getUriForFile(this, getPackageName() + ".provider", pdfFile);

        // Create an Intent to view the PDF
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(pdfUri, "application/pdf");
        intent.setFlags(Intent.FLAG_ACTIVITY_NO_HISTORY);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        // Start the activity
        try {
            startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
            Toast.makeText(this, "No application found to open PDF file", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if (!NetworkUtil.isConnectedToInternet(this)) {
            NetworkUtil.showNoInternetDialog(this);
            return;
        }

        ImageView aboutImage = findViewById(R.id.aboutImage);
        aboutImage.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openPdf();
            }
        });

        // Initialize views
        searchBar = findViewById(R.id.searchBar);
        searchIcon = findViewById(R.id.searchIcon);
        startButton = findViewById(R.id.startButton);
        recyclerView = findViewById(R.id.recyclerView);

        // Load saved service state from SharedPreferences
        SharedPreferences sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isServiceRunning = sharedPreferences.getBoolean(PREFS_KEY_SERVICE_ACTIVE, false);
        startButton.setChecked(isServiceRunning);

        // Start or stop the service based on the saved state
        Intent serviceIntent = new Intent(MainActivity.this, SalineForegroundService.class);
        if (isServiceRunning) {
            startForegroundService(serviceIntent);
        } else {
            stopService(serviceIntent);
        }

        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        dataList = new ArrayList<>();
        filteredList = new ArrayList<>();
        adapter = new MonitoringDataAdapter(filteredList, new MonitoringDataAdapter.OnItemClickListener() {
            @Override
            public void onItemClick(MonitoringData data) {
                showPatientDetailsDialog(data);
            }
        });
        recyclerView.setAdapter(adapter);

        databaseReference = FirebaseDatabase.getInstance().getReference();

        fetchDataFromFirebase();

        searchIcon.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (searchBar.getVisibility() == View.GONE) {
                    searchBar.setVisibility(View.VISIBLE);
                    showKeyboard(searchBar);
                } else {
                    searchBar.setVisibility(View.GONE);
                }
            }
        });

        // Setup Switch
        startButton.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                Intent serviceIntent = new Intent(MainActivity.this, SalineForegroundService.class);
                SharedPreferences sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = sharedPreferences.edit();

                if (isChecked) {
                    startForegroundService(serviceIntent);
                    editor.putBoolean(PREFS_KEY_SERVICE_ACTIVE, true);
                    Toast.makeText(MainActivity.this, "Notification Services are running!", Toast.LENGTH_SHORT).show();
                } else {
                    stopService(serviceIntent);
                    editor.putBoolean(PREFS_KEY_SERVICE_ACTIVE, false);
                    Toast.makeText(MainActivity.this, "Notification Services stopped!", Toast.LENGTH_SHORT).show();
                }
                editor.apply();
            }
        });

        searchBar.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                lastSearchQuery = s.toString().replace(" ", "");
                filterData(lastSearchQuery);
            }

            @Override
            public void afterTextChanged(Editable s) {
            }
        });

        PeriodicWorkRequest fetchDataWorkRequest =
                new PeriodicWorkRequest.Builder(FetchDataWorker.class, 15, TimeUnit.MINUTES)
                        .build();

        WorkManager.getInstance(this).enqueue(fetchDataWorkRequest);

        WorkManager.getInstance(this).getWorkInfoByIdLiveData(fetchDataWorkRequest.getId())
                .observe(this, new Observer<WorkInfo>() {
                    @Override
                    public void onChanged(WorkInfo workInfo) {
                        if (workInfo != null && workInfo.getState().isFinished()) {
                            fetchDataFromFirebase();
                        }
                    }
                });
    }

    private void fetchDataFromFirebase() {
        databaseReference.child("PERCENTAGE").addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                dataList.clear();
                int patientNumber = 1; // Initialize patient number

                for (DataSnapshot percentageSnapshot : dataSnapshot.getChildren()) {
                    String patientId = percentageSnapshot.getKey();
                    double percentage = percentageSnapshot.getValue(Double.class);

                    MonitoringData monitoringData = new MonitoringData(patientId, percentage, patientNumber);
                    dataList.add(monitoringData);
                    patientNumber++; // Increment patient number for the next patient
                }

                // Sort the list based on Firebase percentage
                Collections.sort(dataList, new Comparator<MonitoringData>() {
                    @Override
                    public int compare(MonitoringData o1, MonitoringData o2) {
                        if (o1.getPercentage() == 0) return 1;
                        if (o2.getPercentage() == 0) return -1;
                        return Double.compare(o1.getPercentage(), o2.getPercentage());
                    }
                });

                filterData(lastSearchQuery);
                adapter.notifyDataSetChanged();
            }

            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(MainActivity.this, "Failed to load data: " + databaseError.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }


    private void showKeyboard(View view) {
        if (view.requestFocus()) {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm != null) {
                imm.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT);
            }
        }
    }

    private void filterData(String query) {
        filteredList.clear();
        for (MonitoringData data : dataList) {
            if (data.getPatientId().toLowerCase().contains(query.toLowerCase().replace(" ", ""))) {
                filteredList.add(data);
            }
        }
        adapter.notifyDataSetChanged();
    }

    private void showPatientDetailsDialog(MonitoringData data) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Patient Details");

        View dialogView = getLayoutInflater().inflate(R.layout.dialog_patient_details, null);
        TextView patientIdTextView = dialogView.findViewById(R.id.patientIdTextView);
        TextView percentageTextView = dialogView.findViewById(R.id.percentageTextView);

        patientIdTextView.setText(data.getPatientId());
        percentageTextView.setText(String.format(Locale.getDefault(), "%.2f", data.getPercentage()) + "%");

        builder.setView(dialogView);
        builder.setPositiveButton("OK", null);
        builder.show();
    }

    public static class FetchDataWorker extends Worker {

        public FetchDataWorker(@NonNull Context context, @NonNull WorkerParameters params) {
            super(context, params);
        }

        @NonNull
        @Override
        public Result doWork() {
            // Implement the task to fetch data from Firebase
            // For example, you can make a network request to fetch data from Firebase
            // and store it locally or update the UI accordingly

            // Returning Result.success() to indicate that the work finished successfully
            return Result.success();
        }
    }

    private boolean isServiceRunning(Class<? extends Worker> serviceClass) {
        ActivityManager activityManager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        for (ActivityManager.RunningServiceInfo service : activityManager.getRunningServices(Integer.MAX_VALUE)) {
            if (serviceClass.getName().equals(service.service.getClassName())) {
                return true;
            }
        }
        return false;
    }

    public static class MonitoringData {
        private String patientId;
        private double percentage;
        private int patientNumber; // Add this field

        public MonitoringData() {
            // Default constructor required for calls to DataSnapshot.getValue(MonitoringData.class)
        }

        public MonitoringData(String patientId, double percentage, int patientNumber) {
            this.patientId = patientId;
            this.percentage = percentage;
            this.patientNumber = patientNumber;
        }

        public String getPatientId() {
            return patientId;
        }

        public void setPatientId(String patientId) {
            this.patientId = patientId;
        }

        public double getPercentage() {
            return percentage;
        }

        public void setPercentage(double percentage) {
            this.percentage = percentage;
        }

        public int getPatientNumber() {
            return patientNumber;
        }

        public void setPatientNumber(int patientNumber) {
            this.patientNumber = patientNumber;
        }
    }


    public static class MonitoringDataAdapter extends RecyclerView.Adapter<MonitoringDataAdapter.MonitoringDataViewHolder> {

        private List<MonitoringData> dataList;
        private OnItemClickListener listener;

        public interface OnItemClickListener {
            void onItemClick(MonitoringData data);
        }

        public MonitoringDataAdapter(List<MonitoringData> dataList, OnItemClickListener listener) {
            this.dataList = dataList;
            this.listener = listener;
        }

        @NonNull
        @Override
        public MonitoringDataViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View itemView = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_monitoring_data, parent, false);
            return new MonitoringDataViewHolder(itemView);
        }

        @Override
        public void onBindViewHolder(@NonNull MonitoringDataViewHolder holder, int position) {
            MonitoringData data = dataList.get(position);
            holder.bind(data, listener);
        }

        @Override
        public int getItemCount() {
            return dataList.size();
        }

        static class MonitoringDataViewHolder extends RecyclerView.ViewHolder {
            private TextView patientIdTextView;
            private MeterView meterView;
            private TextView percentageTextView;
            private ImageView statusImageView;

            public MonitoringDataViewHolder(@NonNull View itemView) {
                super(itemView);
                patientIdTextView = itemView.findViewById(R.id.keyTextView);
                meterView = itemView.findViewById(R.id.meterView);
                percentageTextView = itemView.findViewById(R.id.percentageTextView);
                statusImageView = itemView.findViewById(R.id.statusImageView);
            }

            public void bind(final MonitoringData data, final OnItemClickListener listener) {
                patientIdTextView.setText("Patient-" + data.getPatientNumber()); // Display patient number
                percentageTextView.setText(String.format(Locale.getDefault(), "%.2f%%", data.getPercentage()));
                meterView.setPercentage((float) data.getPercentage());

                itemView.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        listener.onItemClick(data);
                    }
                });
            }
        }
    }
}
