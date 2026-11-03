ThisBuild / scalaVersion := "3.5.2"
ThisBuild / version := "0.1.0"
ThisBuild / organization := "bookwriter"

val zioVersion = "2.1.9"

lazy val lokiEngine = ProjectRef(file("../loki-engine"), "lokiEngine")

lazy val bookWriter = (project in file("."))
  .settings(
    name := "book-writer",
    scalaVersion := "3.5.2",
    libraryDependencies ++= Seq(
      "dev.zio" %% "zio" % zioVersion,
      "dev.zio" %% "zio-json" % "0.7.2"
    ),
    dependencyOverrides += "dev.zio" %% "zio" % zioVersion,
    Compile / run / mainClass := Some("bookwriter.Main"),
    Compile / run / fork := true,
    Compile / run / javaOptions ++= Seq("-Dfile.encoding=UTF-8")
  )
  .dependsOn(lokiEngine)
