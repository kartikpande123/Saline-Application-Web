package com.example.salineapp;

import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
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
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity {

    private EditText searchBar;
    private ImageButton searchIcon;
    private Button startButton;
    private RecyclerView recyclerView;
    private MonitoringDataAdapter adapter;
    private List<MonitoringData> dataList;
    private List<MonitoringData> filteredList;

    private DatabaseReference databaseReference;
    private Map<String, Integer> lastValues;
    private Map<String, Long> patientStartTimes;
    private static final int MAX_VALUE = 560;
    private static final int BOTTLE_WEIGHT = 35;
    private String lastSearchQuery = "";
    private boolean isServiceRunning = false;
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

        isServiceRunning = isServiceRunning();

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
        Switch startButton = findViewById(R.id.startButton);
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

        lastValues = new HashMap<>();
        patientStartTimes = new HashMap<>();

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

    private boolean isServiceRunning() {
        ActivityManager manager = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
            if (SalineForegroundService.class.getName().equals(service.service.getClassName())) {
                return true;
            }
        }
        return false;
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

    private void fetchDataFromFirebase() {
        databaseReference.child("Monitoringdata").addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                dataList.clear();
                int patientIndex = 1;

                for (DataSnapshot patientSnapshot : dataSnapshot.getChildren()) {
                    String patientId = "Patient-" + patientIndex++;
                    int value = patientSnapshot.getValue(Integer.class);

                    double percentage;
                    if (value > 0) {
                        // Highlighted condition to set percentage to 0 if value is under 30 grams
                        if (value < 30) {
                            percentage = 0.0;
                        } else {
                            int lastValue = lastValues.containsKey(patientId) ? lastValues.get(patientId) : 0;
                            percentage = ((double) (value - BOTTLE_WEIGHT) / MAX_VALUE) * 100.0;

                            if (!lastValues.containsKey(patientId) || lastValue == 0) {
                                percentage = 100.0;

                                if (!patientStartTimes.containsKey(patientId)) {
                                    patientStartTimes.put(patientId, System.currentTimeMillis());
                                } else {
                                    long currentTime = System.currentTimeMillis();
                                    if (lastValue == 0 && value > 0) {
                                        patientStartTimes.put(patientId, currentTime);
                                    }
                                }
                            }

                            percentage = Math.max(percentage, 0);
                        }
                    } else {
                        percentage = 0;
                        patientStartTimes.remove(patientId);
                    }

                    lastValues.put(patientId, value);

                    MonitoringData monitoringData = new MonitoringData(patientId, percentage, value);
                    dataList.add(monitoringData);
                }

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
                // Handle errors here
            }
        });
    }


    private void showPatientDetailsDialog(MonitoringData data) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        LayoutInflater inflater = getLayoutInflater();
        View dialogView = inflater.inflate(R.layout.dialog_patient_details, null);
        builder.setView(dialogView);

        TextView patientIdTextView = dialogView.findViewById(R.id.patientIdTextView);
        TextView percentageTextView = dialogView.findViewById(R.id.percentageTextView);
        TextView endTimeTextView = dialogView.findViewById(R.id.endTimeTextView);

        patientIdTextView.setText(data.getPatientId());
        percentageTextView.setText(String.format("%.1f%%", data.getPercentage()));

        if (patientStartTimes.containsKey(data.getPatientId())) {
            long startTime = patientStartTimes.get(data.getPatientId());
            long elapsedTime = System.currentTimeMillis() - startTime;

            // Use the same calculation logic as on your web page
            long totalElapsedTime = System.currentTimeMillis() - startTime;
            double elapsedPercentage = (100.0 - data.getPercentage()) / 100.0;
            long predictedEndTime = startTime + (long)(totalElapsedTime / elapsedPercentage);

            SimpleDateFormat dateFormat = new SimpleDateFormat("hh:mm a", Locale.getDefault());
            endTimeTextView.setText("Predicted End Time: " + dateFormat.format(new Date(predictedEndTime)));
        } else {
            endTimeTextView.setText("Predicted End Time: N/A");
        }

        AlertDialog dialog = builder.create(); // Create the dialog here

        Button closeButton = dialogView.findViewById(R.id.closeBtn);
        closeButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dialog.dismiss(); // Close the dialog when the close button is clicked
            }
        });

        dialog.show();
    }



    public static class FetchDataWorker extends Worker {

        public FetchDataWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
            super(context, workerParams);
        }

        @NonNull
        @Override
        public Result doWork() {
            // Perform background data fetching here

            return Result.success();
        }
    }

    public static class MonitoringData {
        private String patientId;
        private double percentage;
        private int value;

        public MonitoringData(String patientId, double percentage, int value) {
            this.patientId = patientId;
            this.percentage = percentage;
            this.value = value;
        }

        public String getPatientId() {
            return patientId;
        }

        public double getPercentage() {
            return percentage;
        }

        public int getValue() {
            return value;
        }
    }

    public static class MonitoringDataAdapter extends RecyclerView.Adapter<MonitoringDataAdapter.ViewHolder> {

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
        public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.item_monitoring_data, parent, false);
            return new ViewHolder(view);
        }

        @Override
        public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
            MonitoringData data = dataList.get(position);
            holder.bind(data, listener);
            holder.keyTextView.setText(data.getPatientId());
            holder.percentageTextView.setText(String.format("%.1f%%", data.getPercentage()));

//            holder.batteryIndicator.setBatteryLevel((int) data.getPercentage());


            // Update MeterView based on the percentage
            holder.meterView.setPercentage((float) data.getPercentage());

            if (data.getPercentage() > 0) {
                holder.statusTextView.setImageResource(R.drawable.wifi_on); // Replace with your correct drawable resource for ✔️
            } else {
                holder.statusTextView.setImageResource(R.drawable.wifi_off); // Replace with your correct drawable resource for ❌
            }

            if (data.getValue() > 0) {
                holder.statusImageView.setImageResource(R.drawable.saline_app_cn);
            } else {
                holder.statusImageView.setImageResource(R.drawable.saline_bc_ntcn);
            }
        }

        @Override
        public int getItemCount() {
            return dataList.size();
        }

        static class ViewHolder extends RecyclerView.ViewHolder {
            TextView keyTextView;
            TextView percentageTextView;
            ImageView statusTextView;
            ImageView statusImageView;
//            BatteryIndicatorView batteryIndicator;
            MeterView meterView; // Added MeterView

            ViewHolder(View itemView) {
                super(itemView);
                keyTextView = itemView.findViewById(R.id.keyTextView);
                percentageTextView = itemView.findViewById(R.id.percentageTextView);
                statusTextView = itemView.findViewById(R.id.statusTextView);
                statusImageView = itemView.findViewById(R.id.statusImageView);
//                batteryIndicator = itemView.findViewById(R.id.batteryIndicator);
                meterView = itemView.findViewById(R.id.meterView); // Initialize MeterView
            }

            void bind(final MonitoringData data, final OnItemClickListener listener) {
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
