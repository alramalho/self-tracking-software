import AVFoundation
import Foundation

@MainActor
final class VoiceLogRecorder: NSObject, ObservableObject, AVAudioRecorderDelegate {
    static let maximumDuration: TimeInterval = 90

    @Published private(set) var isRecording = false
    @Published private(set) var elapsedSeconds: TimeInterval = 0
    var onMaximumDurationReached: ((URL) -> Void)?

    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?
    private var timer: Timer?

    func start() async throws {
        guard await requestMicrophonePermission() else {
            throw VoiceLogRecorderError.microphonePermissionDenied
        }

        let session = AVAudioSession.sharedInstance()
        // `.spokenAudio` is a playback mode and is rejected with OSStatus -50
        // when paired with the record-only category on watchOS. The default
        // mode supports the Watch microphone and AVAudioRecorder reliably.
        try session.setCategory(.record, mode: .default, options: [])
        try session.setActive(true)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("voice-note-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 16_000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]

        let recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder.delegate = self
        recorder.prepareToRecord()
        guard recorder.record() else {
            try? session.setActive(false)
            throw VoiceLogRecorderError.couldNotStart
        }

        self.recorder = recorder
        recordingURL = url
        elapsedSeconds = 0
        isRecording = true
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.elapsedSeconds += 0.25
                if self.elapsedSeconds >= Self.maximumDuration {
                    if let url = try? self.stop() {
                        self.onMaximumDurationReached?(url)
                    }
                }
            }
        }
    }

    func stop() throws -> URL {
        guard let recordingURL else {
            throw VoiceLogRecorderError.noRecording
        }

        recorder?.stop()
        recorder = nil
        timer?.invalidate()
        timer = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false)
        self.recordingURL = nil

        guard FileManager.default.fileExists(atPath: recordingURL.path) else {
            throw VoiceLogRecorderError.noRecording
        }
        return recordingURL
    }

    func cancel() {
        recorder?.stop()
        recorder = nil
        timer?.invalidate()
        timer = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false)
        if let recordingURL {
            try? FileManager.default.removeItem(at: recordingURL)
        }
        recordingURL = nil
    }

    private func requestMicrophonePermission() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted:
            return true
        case .denied:
            return false
        case .undetermined:
            return await withCheckedContinuation { continuation in
                AVAudioApplication.requestRecordPermission { granted in
                    continuation.resume(returning: granted)
                }
            }
        @unknown default:
            return false
        }
    }
}

enum VoiceLogRecorderError: LocalizedError {
    case microphonePermissionDenied
    case couldNotStart
    case noRecording

    var errorDescription: String? {
        switch self {
        case .microphonePermissionDenied:
            return "Microphone access is required. Allow it in the Watch settings and try again."
        case .couldNotStart:
            return "The recording could not be started."
        case .noRecording:
            return "No recording was captured."
        }
    }
}
