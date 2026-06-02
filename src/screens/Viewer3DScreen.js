import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  PixelRatio,
  PanResponder,
  Platform,
} from "react-native";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import {
  generateAllRooms,
  getRoomStatusByKey,
  getRoomName,
  getRoomCapacity,
  getRoomBuilding,
} from "../data/RoomDefs";
import ScreenLayout from "../components/ScreenLayout";
import { useTheme } from "../context/ThemeContext";

// Consolidated Theme for 3D Elements
const ROOM_THEME = {
  available: { color: "#16a34a", emissive: "#14532d" }, // Green
  reserved:  { color: "#f59e0b", emissive: "#78350f" }, // Amber
  occupied:  { color: "#ef4444", emissive: "#7f1d1d" }, // Red
  unknown:   { color: "#64748b", emissive: "#0f172a" }, // Slate
};

const floors = ["all", "3", "2", "1"];

export default function Viewer3DScreen({ navigation }) {
  const { theme } = useTheme();
  const rooms = useMemo(() => generateAllRooms(), []);
  
  const [reservations, setReservations] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [glSize, setGlSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : Dimensions.get("window").width,
    height: 340,
  });

  const isWeb = Platform.OS === "web";

  // Three.js Refs
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const meshRefs = useRef([]);
  const buildingShellRef = useRef(null);
  const resourceTracker = useRef({ geometries: [], materials: [] });
  const cleanupRef = useRef(null);
  const webCanvasRef = useRef(null);

  // Interaction Refs
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const handleTouchRef = useRef(null);

  // Orbit & Zoom Refs
  const thetaRef = useRef(Math.PI / 4);
  const phiRef = useRef(Math.PI / 6);
  const baseTheta = useRef(Math.PI / 4);
  const basePhi = useRef(Math.PI / 6);
  const radiusRef = useRef(210);
  const initialPinchDist = useRef(null);

  // 1. Centralized Color & Visibility Updater
  const updateRoomColors = useCallback(() => {
    if (!meshRefs.current.length) return;

    // Update Room Colors based on Live Status
    meshRefs.current.forEach((roomObj) => {
      const status = getRoomStatusByKey(roomObj.userData.roomNumber, reservations, rooms) || "unknown";
      const isVisible = selectedFloor === "all" || String(roomObj.userData.floor) === selectedFloor;
      
      roomObj.group.visible = isVisible;

      const themeColors = ROOM_THEME[status];
      if (roomObj.carpetMat) {
        roomObj.carpetMat.color.set(themeColors.color);
        roomObj.carpetMat.emissive.set(themeColors.emissive);
      }
      if (roomObj.extWallMat) {
        roomObj.extWallMat.color.set(themeColors.color);
        roomObj.extWallMat.emissive.set(themeColors.emissive);
      }
    });

    // Update Building Shell Visibility (Floors & Roof)
    if (buildingShellRef.current) {
      buildingShellRef.current.children.forEach((child) => {
        if (child.userData?.floor !== undefined) {
          child.visible = selectedFloor === "all" || child.userData.floor === selectedFloor;
        }
        if (child.userData?.isRoof) {
          child.visible = selectedFloor === "all";
        }
      });
    }
  }, [reservations, selectedFloor, rooms]);

  // 2. Fetch Reservations from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "reservations"),
      (snapshot) => {
        setReservations(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => console.error("Viewer3D reservations listen error", err)
    );
    return () => unsubscribe();
  }, []);

  // 3. Trigger Color Updates on Dependency Structural Changes
  useEffect(() => {
    updateRoomColors();
  }, [updateRoomColors]);

  // 4. Shared Scene Builder (Prevents Web/Native Code Duplication)
  const buildSceneContents = useCallback((scene) => {
    const regGeo = (g) => { resourceTracker.current.geometries.push(g); return g; };
    const regMat = (m) => { resourceTracker.current.materials.push(m); return m; };

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(100, 150, 50);
    scene.add(dirLight);

    // Shared Architectural Materials
    const wallMat = regMat(new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 1.0 }));
    const slabMat = regMat(new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 }));
    const colMat = regMat(new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 }));
    const glassMat = regMat(new THREE.MeshStandardMaterial({ color: 0xaaccff, transparent: true, opacity: 0.25, metalness: 0.9, side: THREE.DoubleSide }));
    const frameMat = regMat(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.8 }));
    const invisibleMat = regMat(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));

    const buildingWidth = 100, buildingDepth = 60, floorHeight = 15, numFloors = 3;
    const buildingShell = new THREE.Group();
    buildingShellRef.current = buildingShell;
    scene.add(buildingShell);

    // Build Floors (Slabs, Columns, Facades)
    for (let floor = 1; floor <= numFloors; floor++) {
      const y = (floor - 1) * floorHeight;
      const floorStr = String(floor);

      const slab = new THREE.Mesh(regGeo(new THREE.BoxGeometry(buildingWidth + 2, 1, buildingDepth + 2)), slabMat);
      slab.position.set(0, y + 0.5, 0);
      slab.userData = { floor: floorStr };
      buildingShell.add(slab);

      const colPositions = [
        [-buildingWidth / 2, -buildingDepth / 2], [buildingWidth / 2, -buildingDepth / 2],
        [-buildingWidth / 2, buildingDepth / 2], [buildingWidth / 2, buildingDepth / 2],
        [0, -buildingDepth / 2], [0, buildingDepth / 2],
      ];

      colPositions.forEach(([cx, cz]) => {
        const col = new THREE.Mesh(regGeo(new THREE.BoxGeometry(1.2, floorHeight, 1.2)), colMat);
        col.position.set(cx, y + floorHeight / 2, cz);
        col.userData = { floor: floorStr };
        buildingShell.add(col);
      });

      const addFacade = (fw, fd, fx, fz) => {
        const glass = new THREE.Mesh(regGeo(new THREE.BoxGeometry(fw, floorHeight - 1.5, fd)), glassMat);
        glass.position.set(fx, y + floorHeight / 2 + 0.5, fz);
        glass.userData = { floor: floorStr };
        buildingShell.add(glass);

        const frame = new THREE.Mesh(regGeo(new THREE.BoxGeometry(fw + (fw > fd ? 0.2 : 0), 0.4, fd + (fd > fw ? 0.2 : 0))), frameMat);
        frame.position.set(fx, y + floorHeight / 2 + 0.5, fz);
        frame.userData = { floor: floorStr };
        buildingShell.add(frame);
      };

      addFacade(buildingWidth, 0.2, 0, buildingDepth / 2);
      addFacade(buildingWidth, 0.2, 0, -buildingDepth / 2);
      addFacade(0.2, buildingDepth, buildingWidth / 2, 0);
      addFacade(0.2, buildingDepth, -buildingWidth / 2, 0);
    }

    // Build Roof
    const roof = new THREE.Mesh(regGeo(new THREE.BoxGeometry(buildingWidth + 4, 1.5, buildingDepth + 4)), regMat(new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })));
    roof.position.set(0, numFloors * floorHeight + 0.75, 0);
    roof.userData = { isRoof: true };
    buildingShell.add(roof);

    // Build Rooms
    meshRefs.current = [];
    const roomWidth = 18, roomDepth = 22, wallThickness = 0.4, wallHeight = floorHeight - 1;
    const spacingX = (buildingWidth - 2) / 5;
    const startX = -buildingWidth / 2 + spacingX / 2 + 1;

    rooms.forEach((room) => {
      const roomGroup = new THREE.Group();
      roomGroup.userData = { floor: String(room.floor) };

      const yOffset = (room.floor - 1) * floorHeight;
      const roomIndex = Number(room.roomNumber.slice(1)) - 1;
      const col = roomIndex % 5;
      const row = Math.floor(roomIndex / 5);
      const x = startX + col * spacingX;
      const z = row === 0 ? -buildingDepth / 2 + roomDepth / 2 + 1 : buildingDepth / 2 - roomDepth / 2 - 1;
      const side = row === 0 ? "top" : "bottom";

      // Initialize with default unknown palette colors to prevent flashing
      const carpetMat = regMat(new THREE.MeshStandardMaterial({ color: ROOM_THEME.unknown.color, emissive: ROOM_THEME.unknown.emissive, roughness: 0.7, emissiveIntensity: 0.6 }));
      const extWallMat = regMat(new THREE.MeshStandardMaterial({ color: ROOM_THEME.unknown.color, emissive: ROOM_THEME.unknown.emissive, roughness: 0.6, emissiveIntensity: 0.4 }));

      const carpet = new THREE.Mesh(regGeo(new THREE.PlaneGeometry(roomWidth - 0.5, roomDepth - 0.5)), carpetMat);
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(x, yOffset + 1.1, z);
      roomGroup.add(carpet);

      const buildWall = (w, h, d, px, pz) => {
        const wall = new THREE.Mesh(regGeo(new THREE.BoxGeometry(w, h, d)), wallMat);
        wall.position.set(px, yOffset + 1 + h / 2, pz);
        roomGroup.add(wall);
      };

      buildWall(wallThickness, wallHeight, roomDepth, x - roomWidth / 2, z);
      buildWall(wallThickness, wallHeight, roomDepth, x + roomWidth / 2, z);

      if (side === "top") {
        buildWall(roomWidth - 4, wallHeight, wallThickness, x - 2, z + roomDepth / 2);
        buildWall(roomWidth, wallHeight, wallThickness, x, z - roomDepth / 2);
      } else {
        buildWall(roomWidth - 4, wallHeight, wallThickness, x - 2, z - roomDepth / 2);
        buildWall(roomWidth, wallHeight, wallThickness, x, z + roomDepth / 2);
      }

      const extWallZ = side === "top" ? z + roomDepth / 2 : z - roomDepth / 2;
      const extWall = new THREE.Mesh(regGeo(new THREE.BoxGeometry(roomWidth - 4, wallHeight, wallThickness)), extWallMat);
      extWall.position.set(x - 2, yOffset + 1 + wallHeight / 2, extWallZ);
      roomGroup.add(extWall);

      // Hitbox for raycasting
      const hitbox = new THREE.Mesh(regGeo(new THREE.BoxGeometry(roomWidth, floorHeight, roomDepth)), invisibleMat);
      hitbox.position.set(x, yOffset + floorHeight / 2, z);
      hitbox.userData = { roomNumber: room.roomNumber, floor: String(room.floor) };
      roomGroup.add(hitbox);

      scene.add(roomGroup);
      
      meshRefs.current.push({
        group: roomGroup,
        hitbox,
        carpetMat,
        extWallMat,
        userData: hitbox.userData,
      });
    });
  }, [rooms]);

  // 5. Raycasting Logic
  handleTouchRef.current = (locationX, locationY) => {
    if (!cameraRef.current || !meshRefs.current.length) return;
    const { width, height } = glSize;
    
    pointer.current.set((locationX / width) * 2 - 1, -(locationY / height) * 2 + 1);
    raycaster.current.setFromCamera(pointer.current, cameraRef.current);
    
    const hitboxes = meshRefs.current.map(r => r.hitbox);
    const intersects = raycaster.current.intersectObjects(hitboxes, false);
    
    if (intersects.length > 0 && intersects[0].object.parent.visible) {
      const room = rooms.find((r) => r.roomNumber === intersects[0].object.userData.roomNumber);
      setSelectedRoom(room || null);
    }
  };

  // 6. Gesture Handling (PanResponder)
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      baseTheta.current = thetaRef.current;
      basePhi.current = phiRef.current;
    },
    onPanResponderMove: (e, gestureState) => {
      const touches = e.nativeEvent.touches;

      // Pinch to Zoom
      if (touches.length === 2) {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (initialPinchDist.current === null) {
          initialPinchDist.current = dist;
        } else {
          const delta = initialPinchDist.current - dist;
          radiusRef.current = Math.max(50, Math.min(450, radiusRef.current + delta * 0.8));
          initialPinchDist.current = dist;
        }
      } 
      // Manual Rotation
      else if (touches.length === 1) {
        initialPinchDist.current = null;
        const sensitivity = 0.007;
        thetaRef.current = baseTheta.current - gestureState.dx * sensitivity;
        phiRef.current = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, basePhi.current + gestureState.dy * sensitivity));
      }
    },
    onPanResponderRelease: (e, gestureState) => {
      initialPinchDist.current = null;
      // Tap detection (if movement was minimal)
      if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5 && e.nativeEvent.touches.length === 0) {
        handleTouchRef.current?.(e.nativeEvent.locationX, e.nativeEvent.locationY);
      }
      baseTheta.current = thetaRef.current;
      basePhi.current = phiRef.current;
    }
  }), []);

  // 7. Native GL Context Setup
  const onContextCreate = async (gl) => {
    const { width, height } = glSize;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    cameraRef.current = camera;

    const renderer = new Renderer({ gl, width, height, pixelRatio: PixelRatio.get() });
    renderer.setSize(width, height, false);
    
    buildSceneContents(scene);
    updateRoomColors();

    let frame = null;
    const animate = () => {
      camera.position.x = radiusRef.current * Math.cos(phiRef.current) * Math.sin(thetaRef.current);
      camera.position.y = 30 + radiusRef.current * Math.sin(phiRef.current);
      camera.position.z = radiusRef.current * Math.cos(phiRef.current) * Math.cos(thetaRef.current);
      camera.lookAt(0, 30, 0);
      
      renderer.render(scene, camera);
      gl.endFrameEXP();
      frame = requestAnimationFrame(animate);
    };
    animate();

    cleanupRef.current = () => {
      cancelAnimationFrame(frame);
      resourceTracker.current.geometries.forEach(g => g.dispose());
      resourceTracker.current.materials.forEach(m => m.dispose());
      scene.clear();
      renderer.dispose();
    };
  };

  // 8. Web Context Setup
  useEffect(() => {
    if (!isWeb) return;

    const canvas = webCanvasRef.current;
    const { width, height } = glSize;
    if (!canvas || width <= 0 || height <= 0) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height, false);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 2000);
    cameraRef.current = camera;

    buildSceneContents(scene);
    updateRoomColors();

    let frame = null;
    const animate = () => {
      camera.position.x = radiusRef.current * Math.cos(phiRef.current) * Math.sin(thetaRef.current);
      camera.position.y = 30 + radiusRef.current * Math.sin(phiRef.current);
      camera.position.z = radiusRef.current * Math.cos(phiRef.current) * Math.cos(thetaRef.current);
      camera.lookAt(0, 30, 0);
      
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    cleanupRef.current = () => {
      cancelAnimationFrame(frame);
      resourceTracker.current.geometries.forEach(g => g.dispose());
      resourceTracker.current.materials.forEach(m => m.dispose());
      scene.clear();
      renderer.dispose();
    };

    // Handle Web Resizing
    const handleWindowResize = () => setGlSize({ width: canvas.clientWidth || window.innerWidth, height: 340 });
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [isWeb, glSize, buildSceneContents, updateRoomColors]);

  // Final unmount cleanup
  useEffect(() => {
    return () => { if (cleanupRef.current) cleanupRef.current(); };
  }, []);

  const selectedRoomStatus = selectedRoom ? getRoomStatusByKey(selectedRoom.roomNumber, reservations, rooms) : null;

  return (
    <ScreenLayout navigation={navigation} active="Viewer3D">
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
        <Text style={styles.title}>3D Building Map</Text>
        <Text style={styles.subtitle}>Drag to rotate, pinch to zoom. Tap any inner room to display availability data.</Text>

        <View style={styles.statusLegendRow}>
          <View style={styles.statusLegendItem}>
            <View style={[styles.statusDot, { backgroundColor: ROOM_THEME.available.color }]} />
            <Text style={styles.statusLegendText}>Available</Text>
          </View>
          <View style={styles.statusLegendItem}>
            <View style={[styles.statusDot, { backgroundColor: ROOM_THEME.reserved.color }]} />
            <Text style={styles.statusLegendText}>Reserved</Text>
          </View>
          <View style={styles.statusLegendItem}>
            <View style={[styles.statusDot, { backgroundColor: ROOM_THEME.occupied.color }]} />
            <Text style={styles.statusLegendText}>Occupied</Text>
          </View>
        </View>

        <View 
          style={styles.glViewContainer} 
          onLayout={(e) => setGlSize({ width: e.nativeEvent.layout.width, height: 340 })} 
          {...panResponder.panHandlers}
        >
          {isWeb ? (
            <canvas
              ref={webCanvasRef}
              style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, display: "block" }}
            />
          ) : (
            <GLView style={[styles.glView, { width: glSize.width, height: glSize.height }]} onContextCreate={onContextCreate} />
          )}
        </View>

        <View style={styles.controlRow}>
          {floors.map((floor) => (
            <TouchableOpacity
              key={floor}
              style={[styles.floorButton, selectedFloor === floor && styles.floorButtonActive]}
              onPress={() => setSelectedFloor(floor)}
            >
              <Text style={styles.floorButtonText}>{floor === "all" ? "All Floors" : `Floor ${floor}`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>Room Details</Text>
          {selectedRoom ? (
            <>
              <Text style={styles.detailLabel}>{getRoomName(selectedRoom.roomNumber)}</Text>
              <Text style={styles.detailText}>Building: {getRoomBuilding(selectedRoom.roomNumber)}</Text>
              <Text style={styles.detailText}>Floor: {selectedRoom.floor}</Text>
              <Text style={styles.detailText}>Capacity: {getRoomCapacity(selectedRoom.roomNumber)}</Text>
              <Text style={[styles.statusBadge, { backgroundColor: selectedRoomStatus ? ROOM_THEME[selectedRoomStatus].color : "#64748b" }]}>
                {selectedRoomStatus?.toUpperCase() || "UNKNOWN"}
              </Text>
              <View style={styles.detailActionRow}>
                <TouchableOpacity
                  style={styles.reserveButton}
                  onPress={() => navigation.navigate("Reservation", { roomId: selectedRoom.id })}
                >
                  <Text style={styles.reserveButtonText}>Reserve this room</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearButton} onPress={() => setSelectedRoom(null)}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={styles.detailText}>Tap a room inside the building to review details and perform actions.</Text>
          )}
        </View>

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate("RoomStatus")}> 
          <Text style={styles.backButtonText}>Back to Room Status</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 20, paddingBottom: 28 },
  title: { color: "#ffffff", fontSize: 26, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: "#94a3b8", fontSize: 15, marginBottom: 16 },
  glViewContainer: { width: "100%", height: 340, borderRadius: 20, overflow: "hidden", backgroundColor: "#0b1220", borderWidth: 1, borderColor: "#1e293b", position: "relative" },
  glView: { position: "absolute", top: 0, left: 0 },
  statusLegendRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap" },
  statusLegendItem: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusLegendText: { color: "#cbd5e1", fontSize: 13, fontWeight: "600" },
  controlRow: { flexDirection: "row", flexWrap: "wrap", marginVertical: 16 },
  floorButton: { backgroundColor: "#111827", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginRight: 8, marginBottom: 8 },
  floorButtonActive: { backgroundColor: "#14b8a6" },
  floorButtonText: { color: "#ffffff", fontWeight: "600" },
  detailCard: { backgroundColor: "#111827", borderRadius: 18, padding: 18, marginBottom: 18 },
  detailActionRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 10 },
  clearButton: { backgroundColor: "#1e293b", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center" },
  clearButtonText: { color: "#94a3b8", fontWeight: "700" },
  detailTitle: { color: "#ffffff", fontSize: 18, fontWeight: "700", marginBottom: 14 },
  detailLabel: { color: "#ffffff", fontSize: 16, fontWeight: "700", marginBottom: 10 },
  detailText: { color: "#cbd5e1", marginBottom: 8 },
  statusBadge: { alignSelf: "flex-start", color: "#0f172a", fontWeight: "700", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, marginVertical: 12 },
  reserveButton: { backgroundColor: "#14b8a6", borderRadius: 16, paddingVertical: 14, flex: 1, alignItems: "center" },
  reserveButtonText: { color: "#0f172a", fontWeight: "700" },
  backButton: { backgroundColor: "#2563eb", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  backButtonText: { color: "#ffffff", fontWeight: "700" },
});