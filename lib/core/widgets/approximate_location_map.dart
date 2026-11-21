import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../theme/app_colors.dart';

/// Embedded OpenStreetMap widget for displaying or picking an approximate area.
class ApproximateLocationMap extends StatefulWidget {
  final double latitude;
  final double longitude;
  final double height;
  final bool isInteractive;
  final void Function(double lat, double lng)? onLocationChanged;

  const ApproximateLocationMap({
    super.key,
    required this.latitude,
    required this.longitude,
    this.height = 210,
    this.isInteractive = false,
    this.onLocationChanged,
  });

  @override
  State<ApproximateLocationMap> createState() => _ApproximateLocationMapState();
}

class _ApproximateLocationMapState extends State<ApproximateLocationMap> {
  final MapController _mapController = MapController();

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _zoomBy(double delta) {
    final nextZoom = (_mapController.camera.zoom + delta).clamp(11.0, 18.0);
    _mapController.move(_mapController.camera.center, nextZoom);
  }

  @override
  Widget build(BuildContext context) {
    final point = LatLng(widget.latitude, widget.longitude);

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: widget.height,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: point,
                initialZoom: 15.0,
                interactionOptions: InteractionOptions(
                  flags: widget.isInteractive
                      ? InteractiveFlag.drag |
                  InteractiveFlag.pinchZoom |
                  InteractiveFlag.doubleTapZoom
                      : InteractiveFlag.none,
                ),
                onTap: widget.isInteractive
                    ? (tapPosition, tappedPoint) {
                  widget.onLocationChanged?.call(
                    tappedPoint.latitude,
                    tappedPoint.longitude,
                  );
                }
                    : null,
              ),
              children: [
                TileLayer(
                  urlTemplate:
                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'my.edu.uts.community_service_app',
                ),
                // Translucent radius ring to represent an approximate area (~120m)
                CircleLayer(
                  circles: [
                    CircleMarker(
                      point: point,
                      radius: 120,
                      useRadiusInMeter: true,
                      color: AppColors.primary.withValues(alpha: 0.16),
                      borderColor: AppColors.primary,
                      borderStrokeWidth: 1.5,
                    ),
                  ],
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: point,
                      width: 42,
                      height: 42,
                      alignment: Alignment.topCenter,
                      child: const Icon(
                        Icons.location_pin,
                        size: 42,
                        color: AppColors.error,
                      ),
                    ),
                  ],
                ),
              ],
            ),

            // Top-left hint pill
            Positioned(
              top: 10,
              left: 10,
              child: Container(
                padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      widget.isInteractive
                          ? Icons.touch_app_outlined
                          : Icons.my_location_rounded,
                      size: 14,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      widget.isInteractive
                          ? 'Tap map to set approximate area'
                          : 'Approximate area',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Bottom-right zoom buttons (easy to test on Android Emulator)
            Positioned(
              right: 10,
              bottom: 10,
              child: Column(
                children: [
                  _MapZoomButton(
                    icon: Icons.add,
                    onTap: () => _zoomBy(1),
                  ),
                  const SizedBox(height: 6),
                  _MapZoomButton(
                    icon: Icons.remove,
                    onTap: () => _zoomBy(-1),
                  ),
                ],
              ),
            ),

            // Bottom-left OpenStreetMap attribution
            Positioned(
              left: 8,
              bottom: 6,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '© OpenStreetMap',
                  style: TextStyle(
                    fontSize: 10,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapZoomButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _MapZoomButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.95),
      elevation: 2,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          width: 32,
          height: 32,
          child: Icon(icon, size: 18, color: AppColors.textPrimary),
        ),
      ),
    );
  }
}