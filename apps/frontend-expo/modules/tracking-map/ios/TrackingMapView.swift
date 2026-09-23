import ExpoModulesCore
import MapKit

private struct RoutePoint: Decodable {
    let latitude: CLLocationDegrees
    let longitude: CLLocationDegrees
}

final class TrackingMapView: ExpoView, MKMapViewDelegate {
    private let mapView = MKMapView()
    private var startAnnotation: MKPointAnnotation?
    private var finishAnnotation: MKPointAnnotation?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        clipsToBounds = true
        mapView.delegate = self
        mapView.mapType = .standard
        mapView.showsCompass = false
        mapView.showsScale = false
        mapView.showsBuildings = true
        mapView.isRotateEnabled = false
        mapView.isPitchEnabled = false
        mapView.pointOfInterestFilter = .excludingAll
        addSubview(mapView)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        mapView.frame = bounds
    }

    func setDarkMode(_ dark: Bool) {
        mapView.overrideUserInterfaceStyle = dark ? .dark : .light
    }

    func setRoute(_ routeJSON: String?) {
        guard
            let routeJSON,
            let data = routeJSON.data(using: .utf8),
            let points = try? JSONDecoder().decode([RoutePoint].self, from: data),
            points.count >= 2
        else {
            mapView.removeOverlays(mapView.overlays)
            mapView.removeAnnotations(mapView.annotations)
            startAnnotation = nil
            finishAnnotation = nil
            return
        }

        let coordinates = points.map {
            CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude)
        }
        let polyline = MKPolyline(coordinates: coordinates, count: coordinates.count)

        mapView.removeOverlays(mapView.overlays)
        mapView.removeAnnotations(mapView.annotations)
        mapView.addOverlay(polyline)

        let start = MKPointAnnotation()
        start.coordinate = coordinates[0]
        start.title = "Start"
        let finish = MKPointAnnotation()
        finish.coordinate = coordinates[coordinates.count - 1]
        finish.title = "Finish"
        startAnnotation = start
        finishAnnotation = finish
        mapView.addAnnotations([start, finish])

        let paddedRect = polyline.boundingMapRect.insetBy(dx: -polyline.boundingMapRect.size.width * 0.16, dy: -polyline.boundingMapRect.size.height * 0.16)
        mapView.setVisibleMapRect(
            paddedRect,
            edgePadding: UIEdgeInsets(top: 20, left: 20, bottom: 20, right: 20),
            animated: false
        )
    }

    func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
        guard let polyline = overlay as? MKPolyline else {
            return MKOverlayRenderer(overlay: overlay)
        }
        let renderer = MKPolylineRenderer(polyline: polyline)
        renderer.strokeColor = UIColor.systemYellow
        renderer.lineWidth = 4
        renderer.lineCap = .round
        renderer.lineJoin = .round
        return renderer
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
        guard let title = annotation.title ?? nil else { return nil }
        let reuseIdentifier = title == "Start" ? "tracking-map-start" : "tracking-map-finish"
        let marker = (mapView.dequeueReusableAnnotationView(withIdentifier: reuseIdentifier) as? MKMarkerAnnotationView)
            ?? MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: reuseIdentifier)
        marker.annotation = annotation
        marker.canShowCallout = false
        marker.markerTintColor = title == "Start" ? .systemOrange : .systemGreen
        marker.glyphText = title == "Start" ? "S" : "F"
        return marker
    }
}
